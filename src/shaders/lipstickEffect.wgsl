// src/shaders/lipstickEffect.wgsl (Corrected Vertex Transformation)

struct VertexInput {
  @location(0) pos: vec2f, // Raw NDC from JS, assuming video filled -1 to 1
};
// ... (VertexOut and AspectRatios uniform struct are the same) ...
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

@vertex
fn vert_main(input: VertexInput) -> VertexOut {
  var out: VertexOut;

  let canvasW = aspectRatiosUniform.canvasDimensions.x;
  let canvasH = aspectRatiosUniform.canvasDimensions.y;
  let videoW = aspectRatiosUniform.videoDimensions.x;
  let videoH = aspectRatiosUniform.videoDimensions.y;

  if (canvasH == 0.0 || videoH == 0.0 || videoW == 0.0 || canvasW == 0.0) {
    out.position = vec4f(input.pos, 0.0, 1.0); return out;
  }

  let screenAspect = canvasW / canvasH;  // e.g. ~0.543 (Tall screen)
  let videoAspect = videoW / videoH;    // e.g. 0.75  (Wider video)

  var finalPos = input.pos; // Already in mirrored/inverted NDC space [-1, 1] from JS

  // Apply scaling to fit these NDC coordinates into the letterboxed/pillarboxed video area
  if (videoAspect > screenAspect) {
    // Video is WIDER than the screen area (e.g., 16:9 video on 4:3 screen, or 0.75 video on 0.543 screen).
    // Video will be letterboxed (fill width, bars top/bottom).
    // The effective display height of the video is screenWidth / videoAspect.
    // The scale factor for Y NDC coords is (screenWidth / videoAspect) / screenHeight = screenAspect / videoAspect.
    finalPos.y = input.pos.y * (screenAspect / videoAspect);
  } else {
    // Video is TALLER/SKINNIER than the screen area (or same aspect). Pillarbox.
    // Video will fill screen height. Its display width is screenHeight * videoAspect.
    // The scale factor for X NDC coords is (screenHeight * videoAspect) / screenWidth = videoAspect / screenAspect.
    finalPos.x = input.pos.x * (videoAspect / screenAspect);
  }
  
  out.position = vec4f(finalPos, 0.0, 1.0);
  return out;
}

@fragment
fn frag_main() -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 0.0, 0.7); // Yellow with alpha
}