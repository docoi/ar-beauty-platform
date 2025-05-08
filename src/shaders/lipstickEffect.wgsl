// src/shaders/lipstickEffect.wgsl

@vertex
fn vertexMain(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
  return vec4<f32>(position, 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4<f32> {
  return vec4<f32>(0.2, 0.4, 1.0, 0.8); // Glossy blue lipstick
}
