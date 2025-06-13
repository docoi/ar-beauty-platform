// src/shaders/lipstickEffect.wgsl

// --- Original 2D Lip Overlay Shaders (will be unused for 3D model) ---
// @group(0) @binding(0) var<uniform> aspectRatiosUniform_2D: AspectRatios_2D;
// @group(1) @binding(0) var<uniform> lipstickMaterialUniform_2D: LipstickMaterial_2D;
// struct AspectRatios_2D { videoDimensions: vec2f, canvasDimensions: vec2f };
// struct LipstickMaterial_2D { color: vec4f };
// struct VertexInput_2D { @location(0) pos: vec2f };
// struct VertexOutput_2D { @builtin(position) position: vec4f };

// @vertex
// fn vert_main(input: VertexInput_2D) -> VertexOutput_2D { /* ... original 2D vertex shader ... */ }
// @fragment
// fn frag_main() -> @location(0) vec4f { /* ... original 2D fragment shader ... */ }


// --- NEW Shaders for 3D Lip Model ---

// Group 0: MVP Matrix (and other view/projection related uniforms)
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;
struct SceneUniforms {
  // For video background (first 4 floats):
  // videoDimensions: vec2f,
  // canvasDimensions: vec2f, 
  // For 3D model (next 16 floats, if combined, or separate UBO):
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  modelMatrix: mat4x4f, 
  // We'll need to decide how to pack/unpack these from the aspectRatioUniformBuffer
  // For now, assume separate or correctly offset. Let's assume MVP is passed.
  mvpMatrix: mat4x4f, // Model-View-Projection Matrix
};

// Group 1: Material Properties
@group(1) @binding(0) var<uniform> materialUniforms: MaterialUniforms;
@group(1) @binding(1) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_sampler: sampler;
@group(1) @binding(3) var u_normalTexture: texture_2d<f32>;

struct MaterialUniforms {
  tintColor: vec4f, // Base color tint and alpha
  // Add other material props like roughness, metallic here later
};

// Group 2: Lighting Properties
@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams;
struct LightingParams {
  direction: vec3f, 
  // padded to vec4f in JS buffer, access .xyz
  ambientColor: vec4f,
  diffuseColor: vec4f,
  // Add specularColor, lightPosition etc. later
};

struct VertexInput3D {
  @location(0) position_model: vec3f, // Vertex position in model space
  @location(1) normal_model: vec3f,   // Vertex normal in model space
  @location(2) uv_in: vec2f,          // Vertex UV coordinates
};

struct VertexOutput3D {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
  @location(1) world_normal: vec3f, // Normal in world space (or view space)
  @location(2) world_position: vec3f, // Position in world space (for specular, IBL etc.)
  // Add world_tangent, world_bitangent if doing full TBN
};

@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;

  // For now, assume mvpMatrix is correctly passed and combines model, view, projection
  // Later, we might pass model, view, projection separately for more flexible lighting calcs
  out.clip_position = sceneUniforms.mvpMatrix * vec4f(input.position_model, 1.0);
  
  out.uv = input.uv_in;

  // Transform normal to world space (assuming modelMatrix is world transform)
  // For non-uniform scaling in modelMatrix, (inverse(transpose(modelMatrix)) * normal) is needed.
  // For now, assuming uniform scaling or no scaling in modelMatrix part of MVP.
  // Let's pass a modelMatrix separately in sceneUniforms if we need accurate world normals.
  // Placeholder: if modelMatrix is just identity for now, model_normal is world_normal.
  // We will need to pass a proper normal matrix later (inverse transpose of model's upper 3x3)
  // For now, assume normal is roughly in view/world and normalize. THIS IS A SIMPLIFICATION.
  out.world_normal = normalize(input.normal_model); // THIS IS INCORRECT for a transformed model.
                                                 // Will be corrected when we add transformations.
  out.world_position = input.position_model; // Also needs modelMatrix transform.

  return out;
}

@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  let albedoSample = textureSample(u_albedoTexture, u_sampler, input.uv);
  let baseColor = albedoSample.rgb * materialUniforms.tintColor.rgb;
  let baseAlpha = albedoSample.a * materialUniforms.tintColor.a;

  // Normal Mapping
  let normalMapSample = textureSample(u_normalTexture, u_sampler, input.uv).rgb;
  let tangentSpaceNormal = normalize((normalMapSample * 2.0) - 1.0);

  // --- Simplified Normal Usage (Placeholder - needs proper TBN) ---
  // For now, assume input.world_normal is the geometric normal in a usable space (e.g., view space)
  // And try to use tangentSpaceNormal as if it's directly perturbing that.
  // This is a common simplification if TBN matrix isn't available.
  // A better approach involves a TBN matrix to transform tangentSpaceNormal to world/view space.
  // For now, let's use the tangentSpaceNormal more directly, assuming view direction is -Z
  // and the surface is mostly facing the camera. This is a visual approximation.
  // The normal from the map is treated as if it's already in view space.
  let N = normalize(vec3f(tangentSpaceNormal.xy, tangentSpaceNormal.z)); 
  // let N = normalize(input.world_normal); // Use this if not using normal map yet or normal map is problematic


  // --- Lighting ---
  let L = normalize(lightingUniforms.direction.xyz); // Light direction
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;
  let lambertFactor = max(dot(N, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  
  var finalRgb = ambient + diffuse;

  // Placeholder for specular (needs view direction)
  // let V = normalize(cameraPosition_world - input.world_position); // cameraPosition needs to be a uniform
  // let R = reflect(-L, N);
  // let specFactor = pow(max(dot(R, V), 0.0), 32.0); // 32.0 is shininess
  // let specular = vec3f(0.5, 0.5, 0.5) * specFactor; // Assuming white specular color
  // finalRgb += specular;

  finalRgb = clamp(finalRgb, vec3f(0.0), vec3f(1.0));

  return vec4f(finalRgb, baseAlpha);
}