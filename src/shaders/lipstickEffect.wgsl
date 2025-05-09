@group(0) @binding(0) var<uniform> color : vec4f;

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) fragColor : vec4f
};

@vertex
fn main(@location(0) position : vec2f) -> VertexOut {
  var out : VertexOut;
  out.position = vec4f(position, 0.0, 1.0);
  out.fragColor = color;
  return out;
}

@fragment
fn frag_main(input : VertexOut) -> @location(0) vec4f {
  return input.fragColor;
}
