// src/shaders/videoBackground.wgsl (Corrected "Contain" for Portrait-Dominant Case)

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
    return vec4f(0.0, 0.0, 0.0, 1.0); // Prevent division by zero
  }

  let screenAspect = canvasPhysW / canvasPhysH; // e.g., 1078/1987 = ~0.543 (Tall/Skinny Canvas)
  let videoAspect = videoActualW / videoActualH;     // e.g., 480/640 = 0.75 (Less Tall/Slightly Wider Video)

  var tc = input.uv; // Texcoords from quad, [0,1] range, (0,0) is top-left

  // Scale factors for the texture coordinates
  var scale = vec2f(1.0, 1.0);

  if (videoAspect > screenAspect) {
    // Video is relatively WIDER than the screen area it needs to fit into.
    // (e.g., video 0.75, screen 0.543). Video needs to be scaled down vertically to fit,
    // effectively "letterboxing" (black bars top/bottom).
    // We achieve this by making the V (Y) component of UVs sample a smaller portion of the texture.
    scale.y = screenAspect / videoAspect; // scale.y will be < 1.0 (e.g., 0.543 / 0.75 = ~0.724)
  } else {
    // Video is relatively TALLER (or same aspect) than the screen area.
    // (e.g., video 0.5, screen 1.0). Video needs to be scaled down horizontally to fit,
    // effectively "pillarboxing" (black bars left/right).
    // We achieve this by making the U (X) component of UVs sample a smaller portion of the texture.
    scale.x = videoAspect / screenAspect; // scale.x will be < 1.0
  }
  
  // Transform UVs:
  // 1. Center input UVs (which are 0 to 1) to be -0.5 to 0.5
  // 2. Apply the scale (this makes the sampling area on the texture smaller)
  // 3. Shift back to be centered around 0.5 for the [0,1] texture space
  tc = (tc - vec2f(0.5, 0.5)) * scale + vec2f(0.5, 0.5);

  // Check if the transformed UVs are outside the [0,1] valid texture coordinate range
  if (tc.x < 0.0 || tc.x > 1.0 || tc.y < 0.0 || tc.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars for areas outside the scaled UVs
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, tc);
}