// src/shaders/lipstickEffect.wgsl

@vertex
fn vertex_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vec4f(pos[VertexIndex], 0.0, 1.0);
}

@fragment
fn fragment_main() -> @location(0) vec4f {
  return vec4f(0.0, 0.3, 1.0, 0.3); // Blue glossy transparent overlay
}
