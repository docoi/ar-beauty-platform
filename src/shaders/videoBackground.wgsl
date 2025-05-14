// src/shaders/videoBackground.wgsl (Robust "Contain" Aspect Ratio Correction)

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
@group(1) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios; // Renamed for clarity

@vertex
fn vert_main(@builtin(vertex_index) vertexIndex : u32) -> VertOut {
   let vertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0)
  );
   let uvs = array<vec2f, 6>( // Standard UVs: (0,0) is top-left of texture
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
  let canvasAspect = aspectRatiosUniform.canvasDimensions.x / aspectRatiosUniform.canvasDimensions.y;
  let videoAspect = aspectRatiosUniform.videoDimensions.x / aspectRatiosUniform.videoDimensions.y;

  var scale = vec2f(1.0, 1.0);
  if (videoAspect > canvasAspect) {
    // Video is wider than canvas area: fit to canvas width, letterbox top/bottom
    scale.y = canvasAspect / videoAspect;
  } else {
    // Video is taller (or same aspect) than canvas area: fit to canvas height, pillarbox sides
    scale.x = videoAspect / canvasAspect;
  }

  // input.uv is [0,1] with (0,0) at top-left (based on our uvs array in vertex shader)
  // Center texture coordinates from [0,1] to [-0.5, 0.5]
  let centered_uv = input.uv - vec2f(0.5, 0.5);
  // Apply scaling
  let scaled_uv = centered_uv * scale;
  // Shift back to [0,1] range (or whatever the scaled range is)
  var final_uv = scaled_uv + vec2f(0.5, 0.5);
  
  // If UVs are outside [0,1] after scaling (this means we are in the letterbox/pillarbox area)
  if (final_uv.x < 0.0 || final_uv.x > 1.0 || final_uv.y < 0.0 || final_uv.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, final_uv);
}