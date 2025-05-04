struct Uniforms {
  time: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let uv = fragCoord.xy / vec2f(640.0, 480.0);
  let t = uniforms.time;

  let r = abs(sin(t + uv.x * 3.1415));
  let g = abs(sin(t + uv.y * 6.2831));
  let b = abs(sin(t + (uv.x + uv.y) * 1.5));

  return vec4f(r, g, b, 1.0);
}
