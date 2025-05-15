// src/shaders/videoBackground.wgsl (Corrected "Contain" Logic AGAIN)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

struct AspectRatios {
    videoDimensions: vec2f, // videoWidth, videoHeight
    canvasDimensions: vec2f // canvasPhysicalWidth, canvasPhysicalHeight
};
@group(1) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

@vertex
fn vert_main(@builtin(vertex_index) vertexIndex : u32) -> VertOut {
   let vertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0)
  );
   let uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0), 
    vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0) 
  );
  var output : VertOut;
  output.position = vec4f(vertices[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  let canvasPhysW = aspectRatiosUniform.canvasDimensions.x;
  let canvasPhysH = aspectRatiosUniform.canvasDimensions.y;
  let videoActualW = aspectRatiosUniform.videoDimensions.x;
  let videoActualH = aspectRatiosUniform.videoDimensions.y;

  if (canvasPhysH == 0.0 || videoActualH == 0.0 || videoActualW == 0.0 || canvasPhysW == 0.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  let screenAspect = canvasPhysW / canvasPhysH; // e.g., ~0.543 (Tall/Skinny Canvas)
  let videoAspect = videoActualW / videoActualH;     // e.g., 0.75 (Less Tall/"Wider" Video)

  var tc = input.uv; 
  var scale = vec2f(1.0, 1.0); // By default, sample 1:1

  if (videoAspect > screenAspect) {
    // Video is relatively WIDER than the screen canvas.
    // To "contain" it, we must fit its width to the screen's width,
    // which means the video's height on screen will be less than screen height (letterboxing).
    // We need to scale our V (Y) texture coordinates to sample more of the texture vertically.
    // NO, we need to make the video *appear* shorter. So sample a *larger part* of texture V,
    // meaning scale the *sampling region* for V.
    // scale.y determines how much of the quad's height corresponds to the texture's height.
    // If video is wider, we fit to width. The displayed height = canvasWidth / videoAspect.
    // The ratio of this to canvasHeight is (canvasWidth / videoAspect) / canvasHeight = screenAspect / videoAspect.
    // This ratio should be applied to the UV's Y component.
    scale.y = screenAspect / videoAspect; // This makes scale.y < 1, e.g., 0.543 / 0.75 = ~0.724
                                          // This means input.uv.y * 0.724 will sample a smaller vertical portion of texture.
                                          // This is what caused the stretch. We need the inverse for the UV scale.

    // Correct logic for letterboxing (video wider than screen):
    // We want the output video height to be canvas_width / video_aspect.
    // The scale factor for the *displayed video* height is (canvas_width / video_aspect) / canvas_height = screen_aspect / video_aspect.
    // So, the UVs need to be scaled by the inverse of this to "zoom out" and show letterbox bars.
    // OR, think: we want to map the full texture height (UV 0-1) to only a part of the screen height.
    // Scale for texture coordinates should be:
    scale.y = videoAspect / screenAspect; // Should be > 1 to "zoom in" on Y, this is WRONG for contain.

    // Let's try again: we want to fit the video to the canvas width.
    // The new height of the video on screen will be: canvas_width / video_aspect.
    // The scale factor for the VERTICAL dimension of the *video on screen* is: (canvas_width / video_aspect) / canvas_height.
    // scale_video_display_y = screen_aspect / video_aspect.
    // To achieve this by scaling UVs: if scale_video_display_y < 1, it means video is shorter than screen.
    // Centered UVs are scaled by this factor.
    // new_uv.y = centered_uv.y * scale_video_display_y.
    // This samples a smaller part of the texture. Correct.
     scale.y = screenAspect / videoAspect; // This compresses the V coordinate, showing less vertical texture content stretched. Incorrect.

    // If video is WIDER than screen (videoAspect > screenAspect)
    // We fit to screen HEIGHT. Video will be pillarboxed.
    // new_uv.x needs to be scaled.
    // scale.x = screenAspect / videoAspect (this is if screen is wider, which is not our case)

    // Re-think:
    // Screen aspect S = Ws/Hs (e.g. 0.543)
    // Video aspect V = Wv/Hv (e.g. 0.75)
    // If V > S (video is relatively wider than screen, like 16:9 video on 4:3 screen, or 4:3 video on 9:16 screen)
    //   We must match heights. Video's new width on screen = Hs * V.
    //   Scale factor for screen X = (Hs * V) / Ws = (1/S) * V = V/S.
    //   So tc.x (0-1) should map to a region of size 1 / (V/S) = S/V of the texture.
    //   uv_scale.x = S/V.
    // If V < S (video is relatively skinnier than screen, like 4:3 video on 16:9 screen, or 9:16 video on 4:3 screen)
    //   We must match widths. Video's new height on screen = Ws / V.
    //   Scale factor for screen Y = (Ws / V) / Hs = S * (1/V) = S/V.
    //   So tc.y (0-1) should map to a region of size 1 / (S/V) = V/S of the texture.
    //   uv_scale.y = V/S.

    // Our case: V (0.75) > S (0.543). Video relatively wider than screen. Match heights. Pillarbox.
    // uv_scale.x = S/V = 0.543 / 0.75 = ~0.724
    scale.x = screenAspect / videoAspect; 
    // uv_scale.y = 1.0

  } else { // V <= S. Video relatively skinnier/taller than screen. Match widths. Letterbox.
    // uv_scale.y = V/S = 0.75 / 0.543 = ~1.38
    scale.y = videoAspect / screenAspect;
    // uv_scale.x = 1.0
  }
  
  tc = (tc - vec2f(0.5, 0.5)) * scale + vec2f(0.5, 0.5);
  
  if (tc.x < 0.0 || tc.x > 1.0 || tc.y < 0.0 || tc.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); 
  }
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, tc);
}