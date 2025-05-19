// src/shaders/lipstickEffect.wgsl (Corrected struct definition order and aspect logic)

// DEFINE STRUCT FIRST
struct AspectRatios {
    videoDimensions: vec2f, // videoWidth, videoHeight
    canvasDimensions: vec2f // canvasPhysicalWidth, canvasPhysicalHeight
};

// THEN USE IT IN BINDING
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

struct VertexInput {
  @location(0) pos: vec2f, // Raw NDC from MediaPipe processing (-1 to 1)
                           // This assumes JS has done:
                           // X: (landmark.x - 0.5) * 2  (for non-mirrored video) OR (0.5 - landmark.x) * 2 (for mirrored video)
                           // Y: (0.5 - landmark.y) * 2  (to invert Y)
};

struct VertexOut {
  @builtin(position) position: vec4f,
};

@vertex
fn vert_main(input: VertexInput) -> VertexOut {
  var out: VertexOut;

  let canvasW = aspectRatiosUniform.canvasDimensions.x;
  let canvasH = aspectRatiosUniform.canvasDimensions.y;
  let videoW = aspectRatiosUniform.videoDimensions.x;
  let videoH = aspectRatiosUniform.videoDimensions.y;

  if (canvasH == 0.0 || videoH == 0.0 || videoW == 0.0 || canvasW == 0.0) {
    out.position = vec4f(input.pos, 0.0, 1.0); // Pass through if invalid
    return out;
  }

  let screenAspect = canvasW / canvasH;  // e.g. ~0.543 (Tall screen)
  let videoAspect = videoW / videoH;    // e.g. 0.75  (Wider video relative to a square)

  var finalPos = input.pos; // Already in mirrored/inverted NDC space [-1, 1] from JS

  // Apply scaling to fit these NDC coordinates into the letterboxed/pillarboxed video area
  if (videoAspect > screenAspect) {
    // Video is WIDER than the screen display area (e.g. landscape video on portrait screen, OR portrait video on even skinnier portrait screen).
    // Fit video to screen WIDTH. Video will be letterboxed (bars top/bottom).
    // Scale Y coordinates of the overlay.
    finalPos.y = input.pos.y * (screenAspect / videoAspect);
  } else {
    // Video is TALLER/SKINNIER than the screen display area (or same aspect).
    // (e.g. portrait video on landscape screen, OR portrait video on wider portrait screen).
    // Fit video to screen HEIGHT. Video will be pillarboxed (bars left/right).
    // Scale X coordinates of the overlay.
    finalPos.x = input.pos.x * (videoAspect / screenAspect);
  }
  
  out.position = vec4f(finalPos, 0.0, 1.0);
  return out;
}

@fragment
fn frag_main() -> @location(0) vec4f {
  // Output yellow with 70% alpha for testing blend
  return vec4f(1.0, 1.0, 0.0, 0.7); 
}