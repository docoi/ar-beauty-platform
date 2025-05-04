struct Uniforms {
  time: f32,
  pointer: vec2f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let uv = fragCoord.xy / vec2f(600.0, 800.0); // Normalised (replace with dynamic later)
  let diff = uv - uniforms.pointer;
  let dist = length(diff);

  let color = vec3f(
    0.5 + 0.5 * cos(uniforms.time + dist * 20.0),
    0.5 + 0.5 * sin(uniforms.time + dist * 30.0),
    0.5 + 0.5 * cos(uniforms.time - dist * 40.0)
  );

  return vec4f(color, 1.0);
}
