// src/shaders/lipstickEffect.wgsl (Apply aspect ratio correction to vertices)

struct VertexInput {
  @location(0) pos: vec2f, // Raw NDC from MediaPipe processing (-1 to 1)
};

struct VertexOut {
  @builtin(position) position: vec4f,
  // Add other varying/interpolated values if needed (e.g., UVs for texture-based lipstick)
};

// Uniforms for aspect ratios (same structure as in videoBackground.wgsl)
struct AspectRatios {
    videoDimensions: vec2f, // videoWidth, videoHeight
    canvasDimensions: vec2f // canvasPhysicalWidth, canvasPhysicalHeight
};
// This will now be @group(0) because lipstickPipeline only has one bind group layout
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

@vertex
fn vert_main(input: VertexInput) -> VertexOut {
  var out: VertexOut;

  let canvasPhysW = aspectRatiosUniform.canvasDimensions.x;
  let canvasPhysH = aspectRatiosUniform.canvasDimensions.y;
  let videoActualW = aspectRatiosUniform.videoDimensions.x;
  let videoActualH = aspectRatiosUniform.videoDimensions.y;

  // Default to no scaling/offset if dimensions are zero to prevent division errors
  if (canvasPhysH == 0.0 || videoActualH == 0.0 || videoActualW == 0.0 || canvasPhysW == 0.0) {
    out.position = vec4f(input.pos, 0.0, 1.0); // Pass through if invalid
    return out;
  }

  let screenAspect = canvasPhysW / canvasPhysH; 
  let videoAspect = videoActualW / videoActualH;   

  // input.pos is already in NDC-like coordinates from JS:
  // x from -1 (video right) to +1 (video left)
  // y from -1 (video bottom) to +1 (video top)
  // We need to scale these coordinates to fit the pillarboxed/letterboxed video area.

  var scaledPos = input.pos; // This is centered around 0,0 effectively

  if (videoAspect > screenAspect) {
    // Video is WIDER than screen aspect (e.g. 0.75 > 0.543). Pillarbox.
    // The video on screen fills the height. Its displayed width is screenHeight * videoAspect.
    // The ratio of this displayed width to screenWidth is (screenHeight * videoAspect) / screenWidth
    // = videoAspect / screenAspect.
    // The input.pos.x (which is -1 to 1 for the video) needs to be scaled by this factor.
    scaledPos.x = input.pos.x * (screenAspect / videoAspect); 
  } else {
    // Video is TALLER/SKINNIER than screen aspect. Letterbox.
    // The video on screen fills the width. Its displayed height is screenWidth / videoAspect.
    // The ratio of this displayed height to screenHeight is (screenWidth / videoAspect) / screenHeight
    // = screenAspect / videoAspect.
    // The input.pos.y needs to be scaled by this factor.
    scaledPos.y = input.pos.y * (videoAspect / screenAspect);
  }
  
  out.position = vec4f(scaledPos, 0.0, 1.0);
  return out;
}

@fragment
fn frag_main() -> @location(0) vec4f {
  // Output yellow with 70% alpha for testing blend
  return vec4f(1.0, 1.0, 0.0, 0.7); 
}