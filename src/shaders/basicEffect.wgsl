struct Uniforms {
  time: f32,
  pointer: vec2f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0)
  );
  return vec4f(pos[idx], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let uv = fragCoord.xy / vec2f(400.0, 800.0); // assumes portrait layout
  let p = uniforms.pointer;
  let d = distance(uv, p) * 5.0;
  let t = uniforms.time;

  let r = 0.5 + 0.5 * sin(t + d + 0.0);
  let g = 0.5 + 0.5 * sin(t + d + 2.0);
  let b = 0.5 + 0.5 * sin(t + d + 4.0);

  return vec4f(r, g, b, 1.0);
}
