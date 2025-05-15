// src/shaders/videoBackground.wgsl (More Explicit "Contain" Logic)

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
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0), // BL, BR, TL
    vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0)  // TR, BR, TL
  );
  var output : VertOut;
  output.position = vec4f(vertices[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex]; // Pass raw UVs [0,1] where (0,0) is top-left for texture
  return output;
}

@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  let canvasPhysicalWidth = aspectRatiosUniform.canvasDimensions.x;
  let canvasPhysicalHeight = aspectRatiosUniform.canvasDimensions.y;
  let videoActualWidth = aspectRatiosUniform.videoDimensions.x;
  let videoActualHeight = aspectRatiosUniform.videoDimensions.y;

  let screenAspect = canvasPhysicalWidth / canvasPhysicalHeight; // e.g., 1674/1254 = 1.335
  let videoAspect = videoActualWidth / videoActualHeight;     // e.g., 480/640 = 0.75

  var tc = input.uv; // Texture coordinates from vertex shader [0,1]

  // Calculate scale factors to fit video within screen while maintaining aspect ratio
  var scaleX = 1.0;
  var scaleY = 1.0;
  var offsetX = 0.0;
  var offsetY = 0.0;

  if (videoAspect > screenAspect) {
    // Video is wider than screen aspect ratio (would need letterboxing if screen was portrait)
    // Fit to screen width, scale height
    scaleY = screenAspect / videoAspect;
    offsetY = (1.0 - scaleY) / 2.0;
  } else {
    // Video is taller/skinnier than screen aspect ratio (needs pillarboxing)
    // Fit to screen height, scale width
    scaleX = videoAspect / screenAspect;
    offsetX = (1.0 - scaleX) / 2.0;
  }

  // Apply scale and offset to input UVs
  // Input UVs are [0,1]. We want to sample from a subsection of the texture.
  // new_u = (old_u * scale_x) + offset_x
  // new_v = (old_v * scale_y) + offset_y
  // This is if we are scaling the *quad* down.
  // We are scaling the *texture sampling coordinates* to sample a smaller/larger part of the texture
  // onto the full quad.

  // To map a quad UV (0 to 1) to sample a scaled/offset texture region:
  // centered_quad_uv = input.uv - 0.5
  // scaled_tex_uv_region = centered_quad_uv / scale (where scale > 1 means zoom in, scale < 1 means zoom out to show more texture)
  // final_sample_uv = scaled_tex_uv_region + 0.5

  // Let's use the common "scale the quad" approach mentally, then invert for UVs.
  // If we scale the quad by `scaleX, scaleY` and offset by `offsetX, offsetY` (all in 0-1 space)
  // Transformed UV for sampling:
  // tc.x = (input.uv.x - offsetX) / scaleX;
  // tc.y = (input.uv.y - offsetY) / scaleY;
  // This isn't quite right. Let's use the previous structure that centered UVs first.

  // Corrected "contain" logic:
  // We want to find the UV coordinates on the texture that correspond to the corners of the
  // drawable area on the screen.
  // input.uv are the coordinates on our screen quad (0 to 1).
  // We need to map these to the texture.

  var new_uv = input.uv;
  // Center current UVs from [0,1] to [-0.5, 0.5]
  new_uv = new_uv - vec2f(0.5, 0.5);

  if (screenAspect > videoAspect) {
      // Screen is wider than video (pillarbox video)
      // Scale video's X to fit in screen's X, based on height.
      // The effective width of video on screen will be screenHeight * videoAspect.
      // The scale for X UVs is (screenHeight * videoAspect) / screenWidth = (1/screenAspect) * videoAspect = videoAspect / screenAspect
      new_uv.x = new_uv.x * (videoAspect / screenAspect);
  } else {
      // Screen is skinnier (or same aspect) as video (letterbox video)
      // Scale video's Y to fit in screen's Y, based on width.
      // The effective height of video on screen will be screenWidth / videoAspect.
      // The scale for Y UVs is (screenWidth / videoAspect) / screenHeight = screenAspect / videoAspect.
      new_uv.y = new_uv.y * (screenAspect / videoAspect);
  }

  // Shift UVs back to [0,1] range (or rather, the new scaled range centered at 0.5)
  new_uv = new_uv + vec2f(0.5, 0.5);
  
  // If the transformed UVs are outside the [0,1] range, it means we're in a pillarbox/letterbox area.
  if (new_uv.x < 0.0 || new_uv.x > 1.0 || new_uv.y < 0.0 || new_uv.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, new_uv);
}