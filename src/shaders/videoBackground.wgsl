// src/shaders/videoBackground.wgsl (Standard "Contain" UV Calculation)

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
   let uvs = array<vec2f, 6>( // UVs for quad (0,0 is top-left, 1,1 is bottom-right)
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), // TL, TR, BL
    vec2f(1.0, 1.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0)  // BR, TR, BL (for second triangle)
    // My previous UVs were for BL, BR, TL. Let's try standard TL, TR, BL, BR quad mapping
    // Tri1: TL, BL, TR -> (0,0), (0,1), (1,0)
    // Tri2: TR, BL, BR -> (1,0), (0,1), (1,1)
    // This vertex order for triangles needs to match the standard quad UVs.
    // Vertices: TL, BL, TR,   TR, BL, BR
    //           -1,1  -1,-1  1,1     1,1  -1,-1  1,-1
    // UVs:      0,0   0,1   1,0     1,0   0,1   1,1
  );

  // Let's keep original vertex order and UVs that worked for full screen before:
  // Vertices: BL, BR, TL,   TR, BR, TL
  // UVs:      0,1, 1,1, 0,0,   1,0, 1,1, 0,0
  let final_uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0), 
    vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0) 
  );

  var output : VertOut;
  output.position = vec4f(vertices[vertexIndex], 0.0, 1.0);
  output.uv = final_uvs[vertexIndex]; // These are screen UVs
  return output;
}

@fragment
fn frag_main(input: VertOut) -> @location(0) vec4f {
  let screenDim = aspectRatiosUniform.canvasDimensions;
  let videoDim = aspectRatiosUniform.videoDimensions;

  if (screenDim.y == 0.0 || videoDim.y == 0.0) { return vec4f(0.0,0.0,0.0,1.0); }

  let screenAspect = screenDim.x / screenDim.y; // ~1.335
  let videoAspect = videoDim.x / videoDim.y;   // 0.75

  // Calculate scale factors to make the video fit the screen ("contain")
  var scale = vec2f(screenAspect / videoAspect, 1.0); // Assume video is TALLER/SKINNIER than screen (needs letterboxing)
  if (videoAspect > screenAspect) { // Video is WIDER than screen (needs pillarboxing)
    scale = vec2f(1.0, videoAspect / screenAspect);
  }
  // In our case: videoAspect (0.75) < screenAspect (1.335) is FALSE.
  // So videoAspect > screenAspect is FALSE. (0.75 > 1.335 is FALSE)
  // This means the `else` (if there was one) or the default `scale` is used.
  // My if condition is reversed.
  // If video is WIDER than screen (videoAspect > screenAspect), fit to screen HEIGHT, so scale X of video display is screenAspect / videoAspect
  // If video is TALLER than screen (videoAspect < screenAspect), fit to screen WIDTH, so scale Y of video display is videoAspect / screenAspect

  var texCoord = input.uv; // These are screen UVs from 0.0 to 1.0

  // Calculate the new UVs to sample the texture correctly for "contain"
  let newU = videoDim.x / videoDim.y * canvasDim.y / canvasDim.x; // videoAspect / screenAspect
  let newV = canvasDim.x / canvasDim.y * videoDim.y / videoDim.x; // screenAspect / videoAspect

  var final_uv = tc;

  if (videoAspect > screenAspect) { // Video wider than screen. Pillarbox.
    final_uv.y = (tc.y - 0.5) * (screenAspect / videoAspect) + 0.5; // Scale V coord
  } else { // Video taller/skinnier than screen. Letterbox.
    final_uv.x = (tc.x - 0.5) * (videoAspect / screenAspect) + 0.5; // Scale U coord
  }


  // The logic from webgpufundamentals samples:
  // https://webgpufundamentals.org/webgpu/lessons/webgpu-displaying-html-video.html
  let texcoord_ = input.uv;
  let videoScreenRatio = (screenDim.x / screenDim.y) / (videoDim.x / videoDim.y); // screenAspect / videoAspect
  // if videoScreenRatio > 1 it means screen is wider aspect than video
  // if videoScreenRatio < 1 it means screen is narrower aspect than video

  var sampleTexcoord = texcoord_;
  var videoScreenOffset = vec2f(0.0, 0.0);

  if (videoScreenRatio > 1.0) { // Screen is wider than video (pillarbox)
    sampleTexcoord.x = (texcoord_.x - 0.5) / videoScreenRatio + 0.5;
    // Check if out of bounds (for pillarbox)
    if (sampleTexcoord.x < 0.0 || sampleTexcoord.x > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars
    }
  } else { // Screen is narrower or same aspect as video (letterbox)
    sampleTexcoord.y = (texcoord_.y - 0.5) * videoScreenRatio + 0.5;
    // Check if out of bounds (for letterbox)
     if (sampleTexcoord.y < 0.0 || sampleTexcoord.y > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 1.0); // Black bars
    }
  }
  
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, sampleTexcoord);
}