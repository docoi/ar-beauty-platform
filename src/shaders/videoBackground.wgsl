// src/shaders/videoBackground.wgsl (DEBUG VERSION)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

// These are still declared so the pipeline's bind group layout matches,
// even though videoTexture isn't used in this debug version.
@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

@vertex
fn vert_main(@builtin(vertex_index) vertexIndex : u32) -> VertOut {
  // Vertices for a full-screen quad
   let vertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0), // Bottom Left
    vec2f( 1.0, -1.0), // Bottom Right
    vec2f(-1.0,  1.0), // Top Left

    vec2f( 1.0,  1.0), // Top Right
    vec2f( 1.0, -1.0), // Bottom Right
    vec2f(-1.0,  1.0)  // Top Left
  );

  // UVs (though not strictly needed for solid color, good to keep structure)
   let uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0), // Bottom Left Vert -> (0,1) UV
    vec2f(1.0, 1.0), // Bottom Right Vert -> (1,1) UV
    vec2f(0.0, 0.0), // Top Left Vert -> (0,0) UV

    vec2f(1.0, 0.0), // Top Right Vert -> (1,0) UV
    vec2f(1.0, 1.0), // Bottom Right Vert -> (1,1) UV
    vec2f(0.0, 0.0)  // Top Left Vert -> (0,0) UV
  );

  var output : VertOut;
  output.position = vec4f(vertices[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  // DEBUG: Output solid blue instead of sampling the texture
  return vec4f(0.0, 0.0, 1.0, 1.0); // R=0, G=0, B=1 (Blue), A=1
}