// src/shaders/videoBackground.wgsl (Flip Video Horizontally + "Contain" Aspect Correction)

struct VertOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f, 
};

@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

struct AspectRatios {
    videoDimensions: vec2f, 
    canvasDimensions: vec2f 
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
  let canvasDim = aspectRatiosUniform.canvasDimensions;
  let videoDim = aspectRatiosUniform.videoDimensions;

  if (canvasDim.y < 1.0 || videoDim.y < 1.0 || videoDim.x < 1.0 || canvasDim.x < 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); 
  }

  let screenAspect = canvasDim.x / canvasDim.y; 
  let videoAspect = videoDim.x / videoDim.y;   

  var tc = input.uv; 
  var scale = vec2f(1.0,1.0);

  if (videoAspect > screenAspect) { // Video is WIDER than screen -> Letterbox.
    scale.y = screenAspect / videoAspect;
  } else { // Video is TALLER/SKINNIER than screen -> Pillarbox.
    scale.x = videoAspect / screenAspect;
  }
  
  tc = (tc - vec2f(0.5, 0.5)) / scale + vec2f(0.5, 0.5); // Inverse scale for "contain"
  
  // --- FLIP THE VIDEO HORIZONTALLY for a true, non-mirrored view ---
  tc.x = 1.0 - tc.x;
  // --- END FLIP ---
  
  if (tc.x < 0.0 || tc.x > 1.0 || tc.y < 0.0 || tc.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars
  }

  return textureSampleBaseClampToEdge(videoTexture, videoSampler, tc);
}