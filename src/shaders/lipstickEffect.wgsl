@vertex
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-0.8, -0.6),
    vec2<f32>(0.8, -0.6),
    vec2<f32>(0.0, 0.8),
    vec2<f32>(0.8, -0.6),
    vec2<f32>(0.0, 0.8),
    vec2<f32>(-0.8, 0.8),
  );
  let pos = positions[VertexIndex];
  return vec4<f32>(pos, 0.0, 1.0);
}

@fragment
fn frag_main() -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 1.0, 0.0, 0.8); // Yellow with transparency
}
