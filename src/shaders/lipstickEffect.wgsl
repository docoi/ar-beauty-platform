@group(0) @binding(0) var<uniform> mvpMatrix: mat4x4f;

@vertex
fn vert_main_3d(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return mvpMatrix * vec4f(position, 1.0);
}

@fragment
fn frag_main_3d() -> @location(0) vec4f {
  return vec4f(0.0, 1.0, 1.0, 1.0); // Cyan
}