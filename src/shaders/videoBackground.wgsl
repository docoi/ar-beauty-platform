// src/shaders/videoBackground.wgsl (Standard UVs)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

@vertex
fn vert_main(@builtin(vertex_index) vertexIndex : u32) -> VertOut {
   let vertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0), // Tri 1: BL, BR, TL
    vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0)  // Tri 2: TR, BR, TL
  );

  // Standard UVs (0,0 top-left for texture, 1,1 bottom-right for texture)
  // Matched to the triangle vertices appropriately
   let uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),  // Corresponds to BL vertex (-1,-1)
    vec2f(1.0, 1.0),  // Corresponds to BR vertex ( 1,-1)
    vec2f(0.0, 0.0),  // Corresponds to TL vertex (-1, 1)

    vec2f(1.0, 0.0),  // Corresponds to TR vertex ( 1, 1)
    vec2f(1.0, 1.0),  // Corresponds to BR vertex ( 1,-1)
    vec2f(0.0, 0.0)   // Corresponds to TL vertex (-1, 1)
  );

  var out: VertOut;
  out.position = vec4f(vertices[vertexIndex], 0.0, 1.0);
  out.uv = uvs[vertexIndex]; // Pass standard UVs
  return out;
}

@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, input.uv);
}