// Blue Gloss Lipstick Shader
@vertex
fn vertex_main(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}

@fragment
fn fragment_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
  // Simple blue gloss for testing
  let blue = vec4<f32>(0.2, 0.4, 1.0, 0.5); // RGBA
  return blue;
}
