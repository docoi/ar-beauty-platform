// src/shaders/lipstickEffect.wgsl (Ultra-Simplified Diagnostic)

struct VertexInput {
  @location(0) position: vec3f,
};

@vertex
fn vert_main_3d(input: VertexInput) -> @builtin(position) vec4f {
  // Pass raw coordinates directly. Assume they are already in [-1, 1] clip space.
  // This will look stretched/distorted, but should show SOMETHING if the model is near the origin.
  return vec4f(input.position, 1.0);
}

@fragment
fn frag_main_3d() -> @location(0) vec4f {
  return vec4f(0.0, 1.0, 0.0, 1.0); // Bright Green for a clear visual change
}