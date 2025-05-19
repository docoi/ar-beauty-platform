// src/shaders/videoBackground.wgsl (Corrected variable access for aspect ratio)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

struct AspectRatios {
    videoDimensions: vec2f, // videoWidth, videoHeight
    canvasDimensions: vec2f // canvasPhysicalWidth, canvasPhysicalHeight
};
@group(1) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;

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
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  // Access directly from the uniform struct
  let canvasActualW = aspectRatiosUniform.canvasDimensions.x;
  let canvasActualH = aspectRatiosUniform.canvasDimensions.y;
  let videoActualW = aspectRatiosUniform.videoDimensions.x;
  let videoActualH = aspectRatiosUniform.videoDimensions.y;

  if (canvasActualH == 0.0 || videoActualH == 0.0 || videoActualW == 0.0 || canvasActualW == 0.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); 
  }

  let screenAspect = canvasActualW / canvasActualH; 
  let videoAspect = videoActualW / videoActualH;   

  var sampleTexcoord = input.uv; // input.uv are the raw UVs from the vertex shader [0,1]

  // videoScreenRatio = screenAspect / videoAspect
  // If > 1.0, screen is wider aspect than video -> pillarbox (adjust X)
  // If < 1.0, screen is narrower aspect than video -> letterbox (adjust Y)
  let videoScreenRatio = screenAspect / videoAspect;

  if (videoScreenRatio > 1.0) { // Pillarbox: Adjust X coordinates
    sampleTexcoord.x = (input.uv.x - 0.5) / videoScreenRatio + 0.5;
  } else { // Letterbox: Adjust Y coordinates
    sampleTexcoord.y = (input.uv.y - 0.5) * videoScreenRatio + 0.5;
  }
  
  // Check bounds: if outside, render black (for pillar/letterbox bars)
  if (sampleTexcoord.x < 0.0 || sampleTexcoord.x > 1.0 || sampleTexcoord.y < 0.0 || sampleTexcoord.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); 
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, sampleTexcoord);
}