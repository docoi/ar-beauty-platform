// src/shaders/lipstickEffect.wgsl

struct VertexInput {
  @location(0) position: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 0.0, 1.0);
  return output;
}

@fragment
fn fragmentMain() -> @location(0) vec4<f32> {
  return vec4(0.0, 0.2, 1.0, 0.8); // Blue gloss with alpha
}
