// src/shaders/lipstickEffect.wgsl

// Uniforms for Vertex Shader (Aspect Ratio Correction)
struct AspectRatios {
    videoDimensions: vec2f,
    canvasDimensions: vec2f
};
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

// Uniforms for Fragment Shader (Lipstick Color)
struct LipstickMaterial {
    color: vec4f, // RGBA
};
@group(1) @binding(0) var<uniform> lipstickMaterialUniform: LipstickMaterial;


struct VertexInput {
  @location(0) pos: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
};

@vertex
fn vert_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  let canvasW = aspectRatiosUniform.canvasDimensions.x;
  let canvasH = aspectRatiosUniform.canvasDimensions.y;
  let videoW = aspectRatiosUniform.videoDimensions.x;
  let videoH = aspectRatiosUniform.videoDimensions.y;

  if (canvasH == 0.0 || videoH == 0.0 || videoW == 0.0 || canvasW == 0.0) {
    out.position = vec4f(input.pos, 0.0, 1.0);
    return out;
  }

  let screenAspect = canvasW / canvasH;
  let videoAspect = videoW / videoH;
  var finalPos = input.pos;

  if (videoAspect > screenAspect) {
    finalPos.y = input.pos.y * (screenAspect / videoAspect);
  } else {
    finalPos.x = input.pos.x * (videoAspect / screenAspect);
  }

  out.position = vec4f(finalPos, 0.0, 1.0);
  return out;
}

// CRITICAL PART: Ensure this is using the uniform
@fragment
fn frag_main() -> @location(0) vec4f {
  return lipstickMaterialUniform.color; // <<<< MUST BE THIS
  // NOT return vec4f(1.0, 1.0, 0.0, 0.7); or any other hardcoded color
}