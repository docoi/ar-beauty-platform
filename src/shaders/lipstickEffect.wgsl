export const lipstickShader = `
struct Uniforms {
  time: f32,
  mouseX: f32,
  mouseY: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = fragCoord.xy / vec2<f32>(640.0, 480.0); // assuming canvas size

  let dist = distance(uv, vec2<f32>(uniforms.mouseX, uniforms.mouseY));
  let intensity = smoothstep(0.2, 0.05, dist);

  let lipColor = vec3<f32>(0.8, 0.1, 0.4);
  return vec4<f32>(mix(vec3<f32>(uv, 0.0), lipColor, intensity), 1.0);
}
`;