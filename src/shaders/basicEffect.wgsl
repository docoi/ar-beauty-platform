// File: src/shaders/basicEffect.wgsl

struct Uniforms {
  time: f32,
  pointerX: f32,
  pointerY: f32,
};

@group(0) @binding(0)
var<uniform> u: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0), vec2f(1.0, -1.0), vec2f(1.0,  1.0)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy / vec2f(800.0, 600.0); // Adjust this to your canvas resolution if fixed
  let r = 0.5 + 0.5 * sin(u.time + u.pointerX * 10.0);
  let g = 0.5 + 0.5 * sin(u.time + u.pointerY * 10.0);
  let b = 0.5 + 0.5 * sin(u.time);
  return vec4f(r, g, b, 1.0);
}
