// File: src/shaders/basicEffect.wgsl

struct Uniforms {
  time: f32,
  pointer: vec2f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  return vec4f(positions[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) coord: vec4f) -> @location(0) vec4f {
  let uv = coord.xy / vec2f(1280.0, 720.0); // Adjust as needed
  let dx = uv.x - uniforms.pointer.x;
  let dy = uv.y - uniforms.pointer.y;
  let dist = sqrt(dx * dx + dy * dy);

  let r = 0.5 + 0.5 * sin(10.0 * dist - uniforms.time);
  let g = 0.5 + 0.5 * cos(12.0 * dist + uniforms.time);
  let b = 0.5 + 0.5 * sin(15.0 * dist + uniforms.time * 0.5);

  return vec4f(r, g, b, 1.0);
}
