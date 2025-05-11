struct VertexOut {
  @builtin(position) position: vec4f,
};

@vertex
fn vert_main(@location(0) pos: vec2f) -> VertexOut {
  var out: VertexOut;
  out.position = vec4f(pos, 0.0, 1.0);
  return out;
}

@fragment
fn frag_main() -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 0.0, 1.0); // yellow
}
