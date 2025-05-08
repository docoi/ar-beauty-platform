// src/shaders/lipstickEffect.wgsl

@vertex
fn vertexMain(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4<f32> {
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
fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy / vec2<f32>(1280.0, 720.0); // adjust to your canvas size
  let center = vec2<f32>(0.5, 0.55);
  let radius = 0.08;

  let dist = distance(uv, center);

  if (dist < radius) {
    return vec4<f32>(0.1, 0.3, 1.0, 1.0); // Blue gloss color
  }

  discard;
}
