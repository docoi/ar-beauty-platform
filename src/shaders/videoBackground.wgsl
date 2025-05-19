// src/shaders/videoBackground.wgsl (Final "Contain" Aspect Ratio Correction)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f, // UVs from vertex shader, [0,1] for the quad
};

// Group 0: Bindings for the video texture and its sampler
@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

// Group 1: Uniforms holding dimension information
struct AspectRatios {
    videoDimensions: vec2f, // width, height of the source video
    canvasDimensions: vec2f // physical width, height of the target canvas
};
@group(1) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

// Vertex Shader: Generates a full-screen quad and passes UVs
@vertex
fn vert_main(@builtin(vertex_index) vertexIndex : u32) -> VertOut {
  // Vertices for two triangles covering the screen in Normalized Device Coordinates (NDC) [-1, 1]
   let vertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0), // Bottom Left
    vec2f( 1.0, -1.0), // Bottom Right
    vec2f(-1.0,  1.0), // Top Left

    vec2f( 1.0,  1.0), // Top Right
    vec2f( 1.0, -1.0), // Bottom Right (completing 2nd triangle)
    vec2f(-1.0,  1.0)  // Top Left      (completing 2nd triangle)
  );

  // Standard UV coordinates [0,1], where (0,0) is typically the top-left of a texture.
  // These map to the quad vertices to cover the whole texture by default.
  // BL, BR, TL, TR, BR, TL (vertex order)
   let uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),  // Corresponds to BL vertex (-1,-1)
    vec2f(1.0, 1.0),  // Corresponds to BR vertex ( 1,-1)
    vec2f(0.0, 0.0),  // Corresponds to TL vertex (-1, 1)

    vec2f(1.0, 0.0),  // Corresponds to TR vertex ( 1, 1)
    vec2f(1.0, 1.0),  // Corresponds to BR vertex ( 1,-1)
    vec2f(0.0, 0.0)   // Corresponds to TL vertex (-1, 1)
  );

  var output : VertOut;
  output.position = vec4f(vertices[vertexIndex], 0.0, 1.0); // z=0, w=1
  output.uv = uvs[vertexIndex]; // Pass the raw UVs for the quad
  return output;
}

// Fragment Shader: Samples the video texture with "contain" aspect ratio correction
@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  let canvasDim = aspectRatiosUniform.canvasDimensions;
  let videoDim = aspectRatiosUniform.videoDimensions;

  // Prevent division by zero if dimensions aren't ready or are invalid
  if (canvasDim.y < 1.0 || videoDim.y < 1.0 || videoDim.x < 1.0 || canvasDim.x < 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Return black
  }

  let screenAspect = canvasDim.x / canvasDim.y;  // e.g., ~0.543 (Tall/Skinny Canvas on S21 portrait)
  let videoAspect = videoDim.x / videoDim.y;    // e.g., 0.75 (Standard Portrait Video 480/640, which is "wider" than the screen aspect)

  var tc = input.uv; // input.uv are the quad's UVs, from [0,1], with (0,0) at top-left of quad.
  var scale = vec2f(1.0, 1.0); // This will be the scale of the *content* within the 1x1 UV square.

  if (videoAspect > screenAspect) {
    // Video is WIDER proportionally than the screen. Letterbox.
    // Fit video to screen width. Video's displayed height will be less than screen height.
    // The scale factor for the Y dimension of the content area is screenAspect / videoAspect.
    scale.y = screenAspect / videoAspect; // This will be < 1.0 (e.g., 0.543 / 0.75 = ~0.724)
  } else {
    // Video is TALLER/SKINNIER proportionally than the screen (or same aspect). Pillarbox.
    // Fit video to screen height. Video's displayed width will be less than screen width.
    // The scale factor for the X dimension of the content area is videoAspect / screenAspect.
    scale.x = videoAspect / screenAspect; // This will be < 1.0
  }
  
  // Transform the quad's UV coordinates to sample the correctly scaled part of the texture.
  // 1. Center the quad's UVs (input.uv) around 0.0 (making them range from -0.5 to 0.5).
  // 2. Scale these centered UVs by the *inverse* of the content scale.
  //    (If content is scaled down by 0.724, we need to sample a texture region 1/0.724 times larger).
  // 3. Shift the result back to be centered around 0.5 for the [0,1] texture space.
  tc = (tc - vec2f(0.5, 0.5)) / scale + vec2f(0.5, 0.5);
  
  // If the calculated texture coordinates are outside the [0,1] range,
  // it means this pixel on the quad falls into a letterbox/pillarbox area.
  if (tc.x < 0.0 || tc.x > 1.0 || tc.y < 0.0 || tc.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, tc);
}