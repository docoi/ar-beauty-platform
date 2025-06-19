// src/shaders/lipstickEffect.wgsl

// Group 0, Binding 0: A single uniform buffer containing just the MVP matrix.
@group(0) @binding(0) var<uniform> mvpMatrix: mat4x4f;

// The vertex shader only needs the vertex position from the buffer.
// The pipeline will be configured to only provide this one attribute.
struct VertexInput {
  @location(0) position: vec3f,
};

// The vertex shader's only job is to calculate the final clip space position.
@vertex
fn vert_main_3d(input: VertexInput) -> @builtin(position) vec4f {
  return mvpMatrix * vec4f(input.position, 1.0);
}

// The fragment shader's only job is to output a solid, bright color
// so we can see the shape of the rendered model.
@fragment
fn frag_main_3d() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 1.0, 1.0); // Bright Magenta, fully opaque
}