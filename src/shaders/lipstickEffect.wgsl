// src/shaders/lipstickEffect.wgsl

// UPDATED based on validated solution: Now accepts a single MVP matrix.
@group(0) @binding(0) var<uniform> mvpMatrix: mat4x4f;

// Group 1 & 2 are unchanged
@group(1) @binding(0) var<uniform> materialUniforms: { tintColor: vec4f };
@group(1) @binding(1) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_sampler: sampler;
@group(1) @binding(3) var u_normalTexture: texture_2d<f32>;

@group(2) @binding(0) var<uniform> lightingUniforms: {
  lightDirection: vec3f,
  ambientColor: vec4f,
  diffuseColor: vec4f,
  cameraWorldPosition: vec3f,
};

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

@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;
  
  // As per the solution, calculate final position with the single MVP matrix.
  out.clip_position = mvpMatrix * vec4f(input.position_model, 1.0);
  
  // For now, we pass the model-space data for lighting. This can be improved later.
  out.world_position = input.position_model;
  out.world_normal = input.normal_model;
  
  out.uv = input.uv_in;
  return out;
}

// The fragment shader is simplified for now to ensure rendering works.
@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  let albedoSample = textureSample(u_albedoTexture, u_sampler, input.uv);
  let baseColor = albedoSample.rgb * materialUniforms.tintColor.rgb;
  let baseAlpha = albedoSample.a * materialUniforms.tintColor.a;

  return vec4f(baseColor, baseAlpha);
}