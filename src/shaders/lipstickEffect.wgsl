// src/shaders/lipstickEffect.wgsl (Ultra-Simplified Diagnostic with Visible Color)

// This uniform is expected by the pipeline, but we won't use it in this test
@group(0) @binding(0) var<uniform> mvpMatrix: mat4x4f;

struct VertexInput {
  @location(0) position: vec3f,
};

@vertex
fn vert_main_3d(input: VertexInput) -> @builtin(position) vec4f {
  // We will now use the MVP matrix to correctly position and scale the object
  return mvpMatrix * vec4f(input.position, 1.0);
}

@fragment
fn frag_main_3d() -> @location(0) vec4f {
  // Return a solid, bright, easily identifiable color to see the model's shape.
  return vec4f(1.0, 0.0, 1.0, 1.0); // Bright Magenta
}