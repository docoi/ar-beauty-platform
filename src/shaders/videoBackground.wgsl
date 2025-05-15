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
  let canvasPhysicalWidth = aspectRatiosUniform.canvasDimensions.x;
  let canvasPhysicalHeight = aspectRatiosUniform.canvasDimensions.y;
  let videoActualWidth = aspectRatiosUniform.videoDimensions.x;
  let videoActualHeight = aspectRatiosUniform.videoDimensions.y;

  // Ensure no division by zero if dimensions aren't ready
  if (canvasPhysicalHeight == 0.0 || videoActualHeight == 0.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Return black if not ready
  }

  let screenAspect = canvasPhysicalWidth / canvasPhysicalHeight; 
  let videoAspect = videoActualWidth / videoActualHeight;    

  var final_uv = input.uv;
  var scale = vec2f(1.0, 1.0);

  if (screenAspect > videoAspect) {
      // Screen is wider than video (pillarbox video by scaling X coord)
      // We want to sample a wider portion of texture X to fit the narrower screen X relative to video aspect
      scale.x = videoAspect / screenAspect;
  } else {
      // Screen is skinnier (or same aspect) as video (letterbox video by scaling Y coord)
      scale.y = screenAspect / videoAspect;
  }

  // Transform UVs:
  // 1. Center current UVs (input.uv is [0,1]) around 0.0: (input.uv - 0.5)
  // 2. Apply scaling: (input.uv - 0.5) * scale
  // 3. Shift back to be centered around 0.5: (input.uv - 0.5) * scale + 0.5
  final_uv = (input.uv - vec2f(0.5, 0.5)) * scale + vec2f(0.5, 0.5);
  
  if (final_uv.x < 0.0 || final_uv.x > 1.0 || final_uv.y < 0.0 || final_uv.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars for areas outside the scaled UVs
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, final_uv);
}