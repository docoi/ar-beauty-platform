// src/shaders/lipstickEffect.wgsl

// Group 0, Binding 0: A single uniform buffer containing just the MVP matrix.
@group(0) @binding(0) var<uniform> mvpMatrix: mat4x4f;

// This struct MUST match the vertex buffer layout defined in createPipelines.js
struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f, // Must be declared even if not used in the shader logic
  @location(2) uv: vec2f,     // Must be declared even if not used in the shader logic
};

// The vertex shader's only job is to calculate the final clip space position.
// It will only use the 'position' attribute for this test.
@vertex
fn vert_main_3d(input: VertexInput) -> @builtin(position) vec4f {
  return mvpMatrix * vec4f(input.position, 1.0);
}

// The fragment shader's only job is to output a solid, bright color
// so we can see the shape of the rendered model.
@fragment
fn frag_main_3d() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 1.0, 1.0); // Bright Magenta
}