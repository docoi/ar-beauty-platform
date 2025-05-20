// src/shaders/lipstickEffect.wgsl (Corrected struct order and aspect logic)

struct AspectRatios {
    videoDimensions: vec2f, 
    canvasDimensions: vec2f 
};

@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

struct VertexInput {
  @location(0) pos: vec2f, 
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
    out.position = vec4f(input.pos, 0.0, 1.0); 
    return out;
  }

  let screenAspect = canvasW / canvasH;  // e.g. ~0.543 (Tall screen)
  let videoAspect = videoW / videoH;    // e.g. 0.75  (Wider video relative to a square)

  var finalPos = input.pos; // input.pos is from JS, assumed to be correctly mirrored for tracking

  // Scale to fit into the letterboxed/pillarboxed video area
  if (videoAspect > screenAspect) { 
    // Video is WIDER than the screen display area (aspect ratio sense).
    // This means the video will be letterboxed (fill screen width, bars top/bottom).
    // So, we scale the Y coordinates of the overlay.
    finalPos.y = input.pos.y * (screenAspect / videoAspect); 
  } else { 
    // Video is TALLER/SKINNIER than the screen display area (or same aspect).
    // This means the video will be pillarboxed (fill screen height, bars left/right).
    // So, we scale the X coordinates of the overlay.
    finalPos.x = input.pos.x * (videoAspect / screenAspect);
  }
  
  out.position = vec4f(finalPos, 0.0, 1.0);
  return out;
}

@fragment
fn frag_main() -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 0.0, 0.7); // Yellow with alpha
}