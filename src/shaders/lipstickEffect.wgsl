// src/shaders/lipstickEffect.wgsl

// Group 0: Scene Uniforms
// This struct now correctly matches the JavaScript buffer layout.
struct SceneUniforms {
  mvpMatrix: mat4x4f,
  modelMatrix: mat4x4f,
};
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

// Group 1: Material Properties
struct MaterialUniforms {
  tintColor: vec4f,
};
@group(1) @binding(0) var<uniform> materialUniforms: MaterialUniforms;
@group(1) @binding(1) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_sampler: sampler;
@group(1) @binding(3) var u_normalTexture: texture_2d<f32>;

// Group 2: Lighting Properties
struct LightingParams {
    lightDirection: vec3f,
    // Note: padding is added automatically by WebGPU based on layout rules
    ambientColor: vec4f,
    diffuseColor: vec4f,
    cameraWorldPosition: vec3f,
};
@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams;

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

// --- Main Vertex Shader (Implements MVP logic) ---
@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;
  
  // Calculate final position with the single MVP matrix.
  out.clip_position = sceneUniforms.mvpMatrix * vec4f(input.position_model, 1.0);
  
  // Calculate world position and normals for lighting using the model matrix.
  out.world_position = (sceneUniforms.modelMatrix * vec4f(input.position_model, 1.0)).xyz;
  out.world_normal = normalize((sceneUniforms.modelMatrix * vec4f(input.normal_model, 0.0)).xyz);
  
  out.uv = input.uv_in;
  return out;
}

// --- Main Fragment Shader ---
@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 0.0, 1.0); // BRIGHT YELLOW FULL OPACITY
}
