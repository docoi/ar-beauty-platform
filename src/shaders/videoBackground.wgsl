// src/shaders/videoBackground.wgsl (Corrected "Contain" Logic for Portrait Video on Landscape Canvas)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f, // UVs from vertex shader, typically [0,1] for the quad
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

  // Standard UV coordinates [0,1], where (0,0) is typically the top-left of a texture
  // These map to the quad vertices to cover the whole texture by default.
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

// Fragment Shader: Samples the video texture with aspect ratio correction
@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  let canvasPhysW = aspectRatiosUniform.canvasDimensions.x;
  let canvasPhysH = aspectRatiosUniform.canvasDimensions.y;
  let videoActualW = aspectRatiosUniform.videoDimensions.x;
  let videoActualH = aspectRatiosUniform.videoDimensions.y;

  // Prevent division by zero if dimensions are not ready
  if (canvasPhysH == 0.0 || videoActualH == 0.0 || videoActualW == 0.0 || canvasPhysW == 0.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Return black (or another debug color)
  }

  let screenAspect = canvasPhysW / canvasPhysH; // e.g., ~1.335 (Landscape Canvas)
  let videoAspect = videoActualW / videoActualH;     // e.g., 0.75 (Portrait Video)

  var tc = input.uv; // Texcoords from vertex shader [0,1] for the quad
  var scale = vec2f(1.0, 1.0); // Default: no scaling, sample 1:1

  // Determine scaling factor to "contain" the video within the screen aspect ratio
  if (screenAspect > videoAspect) {
    // Screen is WIDER than video (e.g., landscape screen displaying portrait video).
    // We need to pillarbox (black bars on sides).
    // Fit video to screen height. Video width will be screenHeight * videoAspect.
    // To achieve this by scaling UVs: scale the X-component of UVs.
    // scale.x means how much of the quad's width corresponds to the texture's width.
    // If scale.x < 1, we sample a narrower band of the texture horizontally.
    scale.x = videoAspect / screenAspect; 
  } else {
    // Screen is TALLER/SKINNIER than video (or same aspect).
    // (e.g., portrait screen displaying landscape video, or portrait screen displaying even skinnier portrait video).
    // We need to letterbox (black bars top/bottom).
    // Fit video to screen width. Video height will be screenWidth / videoAspect.
    // Scale the Y-component of UVs.
    scale.y = screenAspect / videoAspect;
  }
  
  // Transform UVs:
  // 1. Center input UVs (which are [0,1]) to be [-0.5, 0.5]
  // 2. Apply the calculated scaling factor
  // 3. Shift back to be centered around 0.5 for the [0,1] texture space
  tc = (tc - vec2f(0.5, 0.5)) * scale + vec2f(0.5, 0.5);
  
  // If the transformed UVs are outside the [0,1] valid texture coordinate range,
  // it means we're in a pillarbox/letterbox area.
  if (tc.x < 0.0 || tc.x > 1.0 || tc.y < 0.0 || tc.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Render black bars
  }

  // Sample the video texture with the corrected texture coordinates
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, tc);
}