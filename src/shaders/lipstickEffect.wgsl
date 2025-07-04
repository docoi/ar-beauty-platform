// src/shaders/lipstickEffect.wgsl

struct VertexInput {
  // We only care about position for this test.
  // The vertex buffer still contains normals and UVs, but the pipeline won't provide them to the shader.
  @location(0) position: vec3f,
};

// This vertex shader ignores all matrices and just scales the raw vertex data.
// This helps verify if the model's geometry is valid and centered around the origin.
@vertex
fn vert_main_3d(input: VertexInput) -> @builtin(position) vec4f {
  // Scale the model down significantly and pass it through.
  // The 'z' coordinate is used for depth testing.
  return vec4f(input.position * 0.3, 1.0);
}

// This fragment shader outputs a solid, bright color to make the shape visible.
@fragment
fn frag_main_3d() -> @location(0) vec4f {
  return vec4f(0.0, 1.0, 1.0, 1.0); // Bright Cyan
}