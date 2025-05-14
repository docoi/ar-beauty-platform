// src/shaders/videoBackground.wgsl (Aspect ratio correction in fragment shader)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f, // Pass raw UVs (0-1 for the quad)
};

// Group 0: Texture and Sampler
@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

// Group 1: Uniforms for aspect ratios
struct AspectRatios {
    videoDimensions: vec2f, // videoWidth, videoHeight
    canvasDimensions: vec2f // canvasPhysicalWidth, canvasPhysicalHeight
};
@group(1) @binding(0) var<uniform> aspectRatios: AspectRatios;

@vertex
fn vert_main(@builtin(vertex_index) vertexIndex : u32) -> VertOut {
   let vertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0)
  );
   let uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0),
    vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0)
  );
  var output : VertOut;
  output.position = vec4f(vertices[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex]; // Pass raw UVs
  return output;
}

@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  let videoAspect = aspectRatios.videoDimensions.x / aspectRatios.videoDimensions.y; // width/height
  let canvasAspect = aspectRatios.canvasDimensions.x / aspectRatios.canvasDimensions.y; // width/height

  var newUV = input.uv; // input.uv is from 0.0 to 1.0, (0,0) is top-left of quad

  // Center the UV coordinates
  newUV = newUV - vec2f(0.5, 0.5); // Center UVs around (0,0)

  if (videoAspect > canvasAspect) {
    // Video is wider than canvas (letterbox)
    // Scale U by canvasAspect / videoAspect to fit horizontally
    // Scale V to keep aspect ratio correct
    newUV.x = newUV.x * (canvasAspect / videoAspect);
  } else {
    // Video is taller than canvas (pillarbox)
    // Scale V by videoAspect / canvasAspect to fit vertically
    // Scale U to keep aspect ratio correct
    newUV.y = newUV.y * (videoAspect / canvasAspect);
  }
  
  // Shift UVs back
  newUV = newUV + vec2f(0.5, 0.5);

  // Check if UVs are within [0,1] range; if not, return clear color or border color
  // This creates the pillarbox/letterbox effect.
  if (newUV.x < 0.0 || newUV.x > 1.0 || newUV.y < 0.0 || newUV.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, newUV);
}