@vertex
fn main(@location(0) position: vec2f) -> @builtin(position) vec4f {
  return vec4f(position, 0.0, 1.0);
}

@fragment
fn main() -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 0.0, 1.0); // Yellow
}
