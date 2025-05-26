// src/shaders/lipstickEffect.wgsl

// Group 0: Aspect Ratios
@group(0) @binding(0) var<uniform> aspectRatiosUniform: AspectRatios;
struct AspectRatios { /* ... */ videoDimensions: vec2f, canvasDimensions: vec2f };

// Group 1: Material Properties
@group(1) @binding(0) var<uniform> lipstickMaterialUniform: LipstickMaterial;
@group(1) @binding(1) var u_lipstickAlbedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_lipstickSampler: sampler; // Renamed for clarity, used for both albedo and normal
@group(1) @binding(3) var u_lipstickNormalTexture: texture_2d<f32>; // NEW: Normal Map

struct LipstickMaterial { /* ... */ color: vec4f, };

// Group 2: Lighting Properties
@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams;
struct LightingParams { /* ... */ direction: vec3f, ambientColor: vec4f, diffuseColor: vec4f, };


struct VertexInput {
  @location(0) pos_ndc: vec2f,
  @location(1) tex_coord: vec2f,
  @location(2) normal_in: vec3f, // Vertex normal (placeholder)
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) view_normal: vec3f, // Interpolated vertex normal (our placeholder (0,0,1))
  // For full tangent space normal mapping, we'd also pass Tangent and Bitangent vectors here.
  // For simplicity, we'll try to work with the view_normal and perturb it.
};

@vertex
fn vert_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  // --- Aspect ratio correction for position (same as before) ---
  let canvasW = aspectRatiosUniform.canvasDimensions.x; let canvasH = aspectRatiosUniform.canvasDimensions.y;
  let videoW = aspectRatiosUniform.videoDimensions.x; let videoH = aspectRatiosUniform.videoDimensions.y;
  var finalPos = input.pos_ndc;
  if (canvasH != 0.0 && videoH != 0.0 && videoW != 0.0 && canvasW != 0.0) {
    let screenAspect = canvasW / canvasH; let videoAspect = videoW / videoH;
    if (videoAspect > screenAspect) { finalPos.y = input.pos_ndc.y * (screenAspect / videoAspect); }
    else { finalPos.x = input.pos_ndc.x * (videoAspect / screenAspect); }
  }
  out.position = vec4f(finalPos, 0.0, 1.0);
  // --- End aspect ratio correction ---

  out.uv = input.tex_coord;
  // We pass the placeholder normal. For actual TBN, this would be the N of the TBN matrix.
  out.view_normal = normalize(input.normal_in);
  return out;
}

// Helper to construct TBN matrix (simplified: assumes view_normal is Z, needs proper Tangent for X)
// For this iteration, we'll directly use the normal map as a view-space perturbation.
// A more robust solution would involve passing a computed TBN matrix or T,B vectors from vertex shader.

fn perturb_normal_approx(view_N: vec3f, normal_tex_sample: vec3f, strength: f32) -> vec3f {
    // Assuming normal_tex_sample is in tangent space (X right, Y up, Z out from surface)
    // And view_N is the geometric normal in view space (our current (0,0,1) placeholder)
    // This is a very simplified perturbation, not true TBN transformation.
    // It basically uses the texture's X and Y to "push" the view_N.
    // The Z from texture can scale the original normal's Z component.

    // Remap texture normal from [0,1] to [-1,1]
    let tangent_norm = (normal_tex_sample * 2.0) - 1.0;

    // A simple way to create a "sort of" tangent and bitangent if view_N is (0,0,1)
    // This is NOT a generally correct TBN matrix construction.
    // It's an approximation that might work for a flat surface facing the camera.
    var T: vec3f;
    if (abs(view_N.x) > abs(view_N.z)) { // If normal is more horizontal, cross with Y up
        T = normalize(cross(vec3f(0.0, 1.0, 0.0), view_N));
    } else { // If normal is more vertical, cross with X right
        T = normalize(cross(view_N, vec3f(1.0, 0.0, 0.0)));
    }
    let B = normalize(cross(view_N, T));
    
    // Transform tangent-space normal to view-space like orientation
    // This is effectively building a TBN matrix on the fly where N_geom is view_N
    let perturbed_N = normalize(T * tangent_norm.x * strength + 
                                B * tangent_norm.y * strength + 
                                view_N * max(0.0, tangent_norm.z)); // Ensure Z doesn't invert view_N
    
    return normalize(view_N + (perturbed_N - view_N) * strength) ; // Blend original normal with perturbed
    // A simpler, direct perturbation (less physically correct but might show effect):
    // return normalize(view_N + vec3f(tangent_norm.x, tangent_norm.y, 0.0) * strength);
}


@fragment
fn frag_main(input: VertexOutput) -> @location(0) vec4f {
  let albedoTextureColor = textureSample(u_lipstickAlbedoTexture, u_lipstickSampler, input.uv);
  let baseColor = albedoTextureColor.rgb * lipstickMaterialUniform.color.rgb;
  let baseAlpha = albedoTextureColor.a * lipstickMaterialUniform.color.a;

  // Sample the normal map
  let normalMapSample = textureSample(u_lipstickNormalTexture, u_lipstickSampler, input.uv).rgb;

  // --- Normal Processing ---
  // Remap normal from [0,1] texture range to [-1,1] vector range
  let tangentSpaceNormal = normalize((normalMapSample * 2.0) - 1.0);

  // For now, our interpolated `input.view_normal` is just (0,0,1) - i.e., facing camera in view space.
  // We will use the tangentSpaceNormal to directly define the normal in lighting calculations.
  // This assumes the normal map is authored such that its "up" (typically blue channel) corresponds
  // to the surface facing directly out, and R/G channels provide X/Y deviations.
  // This is a simplification; proper tangent space normal mapping requires a TBN matrix.
  // Let's try using the tangentSpaceNormal directly for lighting. If it points in weird directions,
  // we'll know the assumption is too simple.
  // We assume the normal map IS the view-space normal for now. This is a common first-pass cheat.
  var N_for_lighting = tangentSpaceNormal;

  // If your normal map is a "world space" or "object space" normal map, you might use it more directly.
  // Most are "tangent space".
  // If the above line gives bad results (e.g. lighting seems inverted or sideways),
  // it means we need to correctly transform it from tangent space to view/world space using TBN.
  // For now, let's try this simple interpretation, assuming the normal map is directly usable as view-space normals for a surface facing the camera.
  // A slightly more involved, but still simplified approach without full TBN from vertex:
  // N_for_lighting = perturb_normal_approx(input.view_normal, normalMapSample, 1.0);
  // Let's try the most direct use first:
  // The default normal (0,0,1) from the texture is "straight out".
  // The R and G channels encode deviations. For a surface facing camera,
  // these deviations can be directly used for x and y components of the view-space normal.
   N_for_lighting = normalize(vec3f(tangentSpaceNormal.xy, tangentSpaceNormal.z));
   // Ensure Z is positive if it's supposed to be "pointing out" of the surface generally towards camera
   // For many tangent space normal maps, Z component (blue channel) is mostly > 0.5 (meaning > 0 after remapping)
   // N_for_lighting.z = max(N_for_lighting.z, 0.001); // Avoid zero Z if it causes issues

  // --- Lighting Calculation ---
  let L = normalize(lightingUniforms.direction.xyz);
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;
  let lambertFactor = max(dot(N_for_lighting, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  let finalRgb = clamp(ambient + diffuse, vec3f(0.0), vec3f(1.0));

  return vec4f(finalRgb, baseAlpha);
}