struct Uniforms {
  time: f32,
  pointer: vec2f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vec4f(pos[index], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let uv = fragCoord.xy / vec2f(400.0, 800.0); // adjust for screen size
  let dx = uv.x - uniforms.pointer.x;
  let dy = uv.y - uniforms.pointer.y;
  let dist = sqrt(dx * dx + dy * dy);
  let color = vec3f(sin(uniforms.time + dist * 10.0), cos(uniforms.time), dist);
  return vec4f(color, 1.0);
}
