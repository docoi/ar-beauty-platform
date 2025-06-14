// src/shaders/lipstickEffect.wgsl

// Group 0: Scene Uniforms
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms3D;
struct SceneUniforms3D {
  // We need separate matrices for correct lighting calculations in world space
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f, 
  // The 'modelMatrix' will be the transformation matrix from MediaPipe to place the lips
  modelMatrix: mat4x4f,
};

// Group 1: Material Properties
@group(1) @binding(0) var<uniform> materialUniforms: MaterialUniforms3D;
@group(1) @binding(1) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_sampler: sampler;
@group(1) @binding(3) var u_normalTexture: texture_2d<f32>;

struct MaterialUniforms3D {
  tintColor: vec4f,
};

// Group 2: Lighting Properties
@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams3D;
struct LightingParams3D {
  lightDirection: vec3f, // Expect a direction FROM the light source
  ambientColor: vec4f,
  diffuseColor: vec4f,
  // NEW: Camera position for specular highlights
  cameraWorldPosition: vec3f,
};

struct VertexInput3D {
  @location(0) position_model: vec3f,
  @location(1) normal_model: vec3f,
  @location(2) uv_in: vec2f,
};

struct VertexOutput3D {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
  @location(1) world_normal: vec3f,
  @location(2) world_position: vec3f,
};

@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;

  // Calculate world position by transforming model position with the model matrix
  let worldPos4 = sceneUniforms.modelMatrix * vec4f(input.position_model, 1.0);
  out.world_position = worldPos4.xyz;

  // Calculate final clip space position
  let viewPos4 = sceneUniforms.viewMatrix * worldPos4;
  out.clip_position = sceneUniforms.projectionMatrix * viewPos4;
  
  // To correctly transform normals, we should use the inverse transpose of the model matrix.
  // This handles non-uniform scaling. For now, we simplify, assuming uniform scaling.
  // A proper implementation would pass a mat3x3f 'normalMatrix'.
  out.world_normal = normalize((sceneUniforms.modelMatrix * vec4f(input.normal_model, 0.0)).xyz);
  
  out.uv = input.uv_in;

  return out;
}


@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  // Sample textures
  let albedoSample = textureSample(u_albedoTexture, u_sampler, input.uv);
  let normalMapSample = textureSample(u_normalTexture, u_sampler, input.uv).rgb;

  // Combine albedo texture with tint color
  let baseColor = albedoSample.rgb * materialUniforms.tintColor.rgb;
  let baseAlpha = albedoSample.a * materialUniforms.tintColor.a;

  // --- Normal Processing ---
  // Remap normal from [0,1] texture range to [-1,1] vector range
  let tangentSpaceNormal = normalize((normalMapSample * 2.0) - 1.0);

  // Use the interpolated geometric normal from the model as the base
  let N_geom = normalize(input.world_normal);

  // For now, we will use the geometric normal for lighting.
  // The next step for ultra-realism would be to create a TBN matrix
  // from the geometric normal, tangents, and bitangents, and use it
  // to transform the tangentSpaceNormal into world space.
  let N = N_geom; 

  // --- Lighting Calculation ---
  let L = normalize(lightingUniforms.lightDirection); // Direction TO the light
  let V = normalize(lightingUniforms.cameraWorldPosition - input.world_position); // Direction TO the camera
  let H = normalize(L + V); // Halfway vector for Blinn-Phong specular

  // Ambient light
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;

  // Diffuse light (Lambertian)
  let lambertFactor = max(dot(N, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  
  // Specular light (Blinn-Phong)
  let specFactor = pow(max(dot(N, H), 0.0), 128.0); // Shininess factor (e.g., 32.0 for satin, 128.0 for gloss)
  let specular = lightingUniforms.diffuseColor.rgb * specFactor * 0.5; // Modulate specular intensity
  
  var finalRgb = ambient + diffuse + specular;

  // Basic gamma correction
  finalRgb = pow(finalRgb, vec3f(1.0/2.2));

  // Clamp to prevent oversaturation, though tone mapping is a better long-term solution
  finalRgb = clamp(finalRgb, vec3f(0.0), vec3f(1.0));

  return vec4f(finalRgb, baseAlpha);
}