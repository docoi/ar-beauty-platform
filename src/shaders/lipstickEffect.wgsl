@vertex
fn vertexMain(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  return vec4f(pos[VertexIndex], 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
  // Render solid blue with slight transparency (lipstick placeholder)
  return vec4f(0.0, 0.2, 1.0, 0.4);
}
