@group(0) @binding(0) var<uniform> color : vec4f;

struct VertexOutput {
  @builtin(position) position: vec4f,
};

@vertex
fn vert_main(@location(0) position: vec2f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  return output;
}

@fragment
fn frag_main(input: VertexOutput) -> @location(0) vec4f {
  return color;
}
