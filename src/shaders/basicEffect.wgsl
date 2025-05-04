struct Uniforms {
  time: f32,
  pointer: vec2<f32>,
  resolution: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vec4f(positions[index], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let uv = fragCoord.xy / u.resolution;
  let dx = uv.x - u.pointer.x;
  let dy = uv.y - u.pointer.y;
  let dist = sqrt(dx * dx + dy * dy);
  let pulse = 0.5 + 0.5 * sin(10.0 * dist - u.time * 5.0);

  return vec4f(pulse, uv.y, uv.x, 1.0);
}
