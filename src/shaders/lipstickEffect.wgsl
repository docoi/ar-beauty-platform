// src/shaders/lipstickEffect.wgsl

// Group 0: Scene Uniforms (for vertex shader)
// UPDATED: Now accepts a pre-computed MVP matrix and the final model matrix
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms3D;
struct SceneUniforms3D {
  mvpMatrix: mat4x4f,
  modelMatrix: mat4x4f, // Used for lighting calculations
};

// Group 1 & 2 are unchanged
@group(1) @binding(0) var<uniform> materialUniforms: MaterialUniforms3D;
@group(1) @binding(1) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_sampler: sampler;
@group(1) @binding(3) var u_normalTexture: texture_2d<f32>;
struct MaterialUniforms3D { tintColor: vec4f, };

@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams3D;
struct LightingParams3D {
  lightDirection: vec3f,
  ambientColor: vec4f,
  diffuseColor: vec4f,
  cameraWorldPosition: vec3f,
};

// Vertex I/O structs are unchanged
struct VertexInput3D {
  @location(0) position_model: vec3f,
  @location(1) normal_model: vec3f,
  @location(2) uv_in: vec2f,
};
struct VertexOutput3D {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
  @location(1) world_normal: vec3f,
  @location(2) world_position: vec3f,
};

// --- Main Vertex Shader UPDATED ---
@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;

  // 1. Calculate the final clip-space position using the pre-computed MVP matrix.
  out.clip_position = sceneUniforms.mvpMatrix * vec4f(input.position_model, 1.0);
  
  // 2. Calculate world-space data for lighting using the separate model matrix.
  out.world_position = (sceneUniforms.modelMatrix * vec4f(input.position_model, 1.0)).xyz;
  out.world_normal = normalize((sceneUniforms.modelMatrix * vec4f(input.normal_model, 0.0)).xyz);
  
  out.uv = input.uv_in;
  return out;
}

// --- Main Fragment Shader (Unchanged) ---
@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  let albedoSample = textureSample(u_albedoTexture, u_sampler, input.uv);
  let normalMapSample = textureSample(u_normalTexture, u_sampler, input.uv).rgb;
  let baseColor = albedoSample.rgb * materialUniforms.tintColor.rgb;
  let baseAlpha = albedoSample.a * materialUniforms.tintColor.a;
  let N = normalize(input.world_normal);
  let L = normalize(lightingUniforms.lightDirection);
  let V = normalize(lightingUniforms.cameraWorldPosition - input.world_position);
  let H = normalize(L + V);
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;
  let lambertFactor = max(dot(N, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  let specFactor = pow(max(dot(N, H), 0.0), 128.0);
  let specular = lightingUniforms.diffuseColor.rgb * specFactor * 0.7;
  var finalRgb = ambient + diffuse + specular;
  finalRgb = pow(finalRgb, vec3f(1.0/2.2));
  finalRgb = clamp(finalRgb, vec3f(0.0), vec3f(1.0));
  return vec4f(finalRgb, baseAlpha);
}