// src/shaders/lipstickEffect.wgsl

// Group 0: Scene Uniforms (for vertex shader)
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms3D;
struct SceneUniforms3D {
  // For this test, we only need the combined MVP matrix
  mvpMatrix: mat4x4f,
};

// Groups 1 and 2 are unused by this simplified shader, but the bindings must still exist if the pipeline expects them.

struct VertexInput3D {
  @location(0) position_model: vec3f,
  // Normals and UVs are received but not used in this simplified version
  @location(1) normal_model: vec3f,
  @location(2) uv_in: vec2f,
};

struct VertexOutput3D {
  @builtin(position) clip_position: vec4f,
};

// --- Vertex Shader for 3D Model (Simplified for visibility test) ---
@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;
  // Transform vertex position by MVP matrix. This is the only thing we need to test geometry rendering.
  out.clip_position = sceneUniforms.mvpMatrix * vec4f(input.position_model, 1.0);
  return out;
}

// --- Fragment Shader for 3D Model (Simplified for visibility test) ---
@fragment
fn frag_main_3d() -> @location(0) vec4f {
  // Output a solid, bright, easily identifiable color.
  // This proves that the fragment shader is running for the pixels covered by the model.
  return vec4f(1.0, 0.0, 1.0, 1.0); // Bright Magenta, fully opaque
}