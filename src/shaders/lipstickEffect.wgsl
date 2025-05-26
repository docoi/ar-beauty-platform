// src/shaders/lipstickEffect.wgsl

// Uniforms for Vertex Shader (Aspect Ratio Correction)
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;
struct AspectRatios {
    videoDimensions: vec2f,
    canvasDimensions: vec2f
};

// Uniforms and Textures for Fragment Shader (Material)
@group(1) @binding(0) var<uniform> lipstickMaterialUniform: LipstickMaterial;
@group(1) @binding(1) var u_lipstickAlbedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_lipstickAlbedoSampler: sampler;

struct LipstickMaterial {
    color: vec4f, // Tint and alpha for the albedo texture
};

// NEW: Uniforms for Fragment Shader (Lighting)
@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams;

struct LightingParams {
  direction: vec3f, // Light direction (world/view space)
  // WGSL requires vec4 alignment for struct members following a vec3 if not last.
  // So, direction will be padded to vec4f in the JS buffer.
  // We only use .xyz here.
  ambientColor: vec4f,
  diffuseColor: vec4f,
};


// Input to Vertex Shader
struct VertexInput {
  @location(0) pos_ndc: vec2f,   // Vertex position (NDC)
  @location(1) tex_coord: vec2f, // Vertex UV coordinates
  @location(2) normal_in: vec3f, // Vertex normal (world/view space - currently placeholder)
};

// Output from Vertex Shader / Input to Fragment Shader
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) normal: vec3f, // Pass normal to fragment shader
};

@vertex
fn vert_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // --- Aspect ratio correction for position (same as before) ---
  let canvasW = aspectRatiosUniform.canvasDimensions.x;
  let canvasH = aspectRatiosUniform.canvasDimensions.y;
  let videoW = aspectRatiosUniform.videoDimensions.x;
  let videoH = aspectRatiosUniform.videoDimensions.y;

  var finalPos = input.pos_ndc;
  if (canvasH != 0.0 && videoH != 0.0 && videoW != 0.0 && canvasW != 0.0) {
    let screenAspect = canvasW / canvasH;
    let videoAspect = videoW / videoH;
    if (videoAspect > screenAspect) {
      finalPos.y = input.pos_ndc.y * (screenAspect / videoAspect);
    } else {
      finalPos.x = input.pos_ndc.x * (videoAspect / screenAspect);
    }
  }
  out.position = vec4f(finalPos, 0.0, 1.0);
  // --- End aspect ratio correction ---

  out.uv = input.tex_coord;
  out.normal = normalize(input.normal_in); // Pass through and normalize the normal
                                          // (crucial if normals aren't unit length)
  return out;
}

@fragment
fn frag_main(input: VertexOutput) -> @location(0) vec4f {
  // Sample the albedo texture
  let albedoTextureColor = textureSample(u_lipstickAlbedoTexture, u_lipstickAlbedoSampler, input.uv);

  // Apply tint from uniform
  let baseColor = albedoTextureColor.rgb * lipstickMaterialUniform.color.rgb;
  let baseAlpha = albedoTextureColor.a * lipstickMaterialUniform.color.a;

  // --- Lighting Calculation ---
  // Ensure normal is unit length after interpolation
  let N = normalize(input.normal);
  // Light direction should be normalized if it isn't already guaranteed by the uniform's source
  let L = normalize(lightingUniforms.direction.xyz); // Use .xyz due to padding in JS

  // Ambient light
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;

  // Diffuse light (Lambertian)
  let lambertFactor = max(dot(N, L), 0.0); // Ensure it's not negative
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;

  // Combine lighting
  let finalRgb = ambient + diffuse;

  // Clamp final color to [0,1] range to prevent over-brightness if lights are too strong
  // Though with physically based rendering, you'd often do tone mapping later instead.
  // For this basic lighting, clamping is fine.
  let clampedRgb = clamp(finalRgb, vec3f(0.0,0.0,0.0), vec3f(1.0,1.0,1.0));

  return vec4f(clampedRgb, baseAlpha);
}