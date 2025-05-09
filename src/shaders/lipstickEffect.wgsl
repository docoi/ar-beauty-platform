struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn main_vertex(
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>
) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(position, 0.0, 1.0);
  output.color = color;
  return output;
}

@fragment
fn main_fragment(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}
