@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@group(0) @binding(0)
var<uniform> time: f32;

@fragment
fn fs_main(@builtin(position) coord: vec4f) -> @location(0) vec4f {
  let uv = coord.xy / vec2f(600.0, 800.0); // Hardcoded resolution for now
  let color = vec3f(
    0.5 + 0.5 * sin(time + uv.x * 10.0),
    0.5 + 0.5 * cos(time + uv.y * 10.0),
    0.5 + 0.5 * sin(time + uv.x * uv.y * 15.0)
  );
  return vec4f(color, 1.0);
}
