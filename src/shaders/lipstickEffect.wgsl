// src/shaders/lipstickEffect.wgsl

// Uniforms for Vertex Shader (Aspect Ratio Correction)
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;
struct AspectRatios { // Define struct before use if not already globally visible
    videoDimensions: vec2f,
    canvasDimensions: vec2f
};


// Uniforms and Textures for Fragment Shader
@group(1) @binding(0) var<uniform> lipstickMaterialUniform: LipstickMaterial;
@group(1) @binding(1) var u_lipstickAlbedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_lipstickAlbedoSampler: sampler;

struct LipstickMaterial {
    color: vec4f, // Now primarily used for tinting and alpha
};

// Input to Vertex Shader
struct VertexInput {
  @location(0) pos: vec2f,       // Vertex position (NDC)
  @location(1) tex_coord: vec2f, // Vertex UV coordinates
};

// Output from Vertex Shader / Input to Fragment Shader
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f, // Pass UVs to fragment shader
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
    out.uv = input.tex_coord; // Still pass UVs
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
  out.uv = input.tex_coord; // Pass through the original UV coordinates
                            // We might need to transform these too if they are not in the correct space for the texture
  return out;
}

@fragment
fn frag_main(input: VertexOutput) -> @location(0) vec4f {
  // Sample the albedo texture
  let textureColor = textureSample(u_lipstickAlbedoTexture, u_lipstickAlbedoSampler, input.uv);

  // Combine texture color with uniform color (tint & alpha)
  // Option 1: Texture RGB, Uniform Alpha
  // return vec4f(textureColor.rgb, lipstickMaterialUniform.color.a);

  // Option 2: Modulate (multiply) texture RGB with uniform RGB, use uniform Alpha
  // This allows the uniform color to tint the texture.
  var final_color = textureColor.rgb * lipstickMaterialUniform.color.rgb;
  return vec4f(final_color, lipstickMaterialUniform.color.a * textureColor.a); // also multiply alphas

  // Option 3: Just texture color directly (if uniform is only for fallback or other params)
  // return textureColor;

  // Let's start with Option 2 for tinting capability and using uniform's alpha.
  // Make sure the alpha from the uniform (e.g., from LIPSTICK_COLORS) makes sense.
}