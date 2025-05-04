// src/shaders/basicEffect.wgsl
struct Uniforms {
  time: f32,
  mouse: vec2<f32>,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
  );
  return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = fragCoord.xy / vec2<f32>(600.0, 600.0); // Update for responsive canvas
  let t = uniforms.time;
  let dx = uv.x - uniforms.mouse.x;
  let dy = uv.y - uniforms.mouse.y;
  let dist = sqrt(dx * dx + dy * dy);

  let color = vec3<f32>(
    0.5 + 0.5 * cos(t + dist * 10.0),
    0.5 + 0.5 * cos(t + dist * 10.0 + 2.0),
    0.5 + 0.5 * cos(t + dist * 10.0 + 4.0)
  );

  return vec4<f32>(color, 1.0);
}
