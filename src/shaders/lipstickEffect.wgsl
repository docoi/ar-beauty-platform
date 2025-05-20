// src/shaders/lipstickEffect.wgsl (Vertex shader to mimic videoBackground UV transform)

struct AspectRatios {
    videoDimensions: vec2f, 
    canvasDimensions: vec2f 
};
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

struct VertexInput { @location(0) pos: vec2f, }; // NDC from JS: -1 to 1
struct VertexOut { @builtin(position) position: vec4f, };

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

  let screenAspect = canvasW / canvasH;  
  let videoAspect = videoW / videoH;    

  // Convert input.pos (NDC -1 to 1 for full video frame) to "pretend UVs" (0 to 1 for full video frame)
  // input.pos.x: -1 (left) to 1 (right)  => pretendUv.x: 0 (left) to 1 (right)
  // input.pos.y: -1 (bottom) to 1 (top) => pretendUv.y: 0 (top) to 1 (bottom) (because shader Y is often down for textures)
  // However, our JS already did (0.5 - pt.y)*2, making input.pos.y: +1 top, -1 bottom.
  // Let's convert input.pos (NDC: Y up) to UV-like (0-1, Y down for consistency with typical texture ops)
  var pseudoUV = vec2f((input.pos.x + 1.0) / 2.0, (1.0 - input.pos.y) / 2.0); 
                                                  // (1.0 - input.pos.y) / 2.0 maps NDC Y up to UV Y down

  var scale = vec2f(1.0, 1.0); // This is the scale of the *content area* within a 1x1 box
  if (videoAspect > screenAspect) { // Video is wider than screen -> Letterbox
    scale.y = screenAspect / videoAspect; // e.g. ~0.723
  } else { // Video is skinnier than screen -> Pillarbox
    scale.x = videoAspect / screenAspect;
  }
  
  // Transform pseudoUVs just like in videoBackground.wgsl
  // Centered UVs: pseudoUV - 0.5
  // Scaled to fit content box: (pseudoUV - 0.5) * scale
  // Shifted back: (pseudoUV - 0.5) * scale + 0.5
  var transformedUvForContentBox = (pseudoUV - vec2f(0.5, 0.5)) * scale + vec2f(0.5, 0.5);

  // Now, convert these 0-1 UVs (which are now relative to the letterboxed/pillarboxed video)
  // back to -1 to 1 NDC for screen display.
  // The `transformedUvForContentBox` effectively *is* already the position within the -1 to 1 NDC
  // if we consider the letterbox/pillarbox as the new -1 to 1 space.
  // No, this is not quite right. `transformedUvForContentBox` is where the content *lies* in the 0-1 space.
  // The original `input.pos` needs to be scaled by these factors.

  // Let's retry the simpler scaling from before, it was closer:
  var finalPos = input.pos;
  if (videoAspect > screenAspect) { // Letterbox case for your S21
    finalPos.y = input.pos.y * (screenAspect / videoAspect);
  } else { // Pillarbox case
    finalPos.x = input.pos.x * (videoAspect / screenAspect);
  }
  // This scales the original -1 to 1 values. This should be correct.

  out.position = vec4f(finalPos, 0.0, 1.0);
  return out;
}

@fragment
fn frag_main() -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 0.0, 0.7); // Yellow with alpha
}