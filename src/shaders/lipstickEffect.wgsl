// src/shaders/lipstickEffect.wgsl

// Group 0: Scene Uniforms (for vertex shader)
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms3D;
struct SceneUniforms3D {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f, 
  modelMatrix: mat4x4f,
  // For correct lighting on non-uniformly scaled models, a normalMatrix is better.
  // normalMatrix: mat3x3f,
};

// Group 1: Material Properties (for fragment shader)
@group(1) @binding(0) var<uniform> materialUniforms: MaterialUniforms3D;
@group(1) @binding(1) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_sampler: sampler;
@group(1) @binding(3) var u_normalTexture: texture_2d<f32>;

struct MaterialUniforms3D {
  tintColor: vec4f,
};

// Group 2: Lighting Properties (for fragment shader)
@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams3D;
struct LightingParams3D {
  lightDirection: vec3f, // Direction FROM the light source
  ambientColor: vec4f,
  diffuseColor: vec4f,
  cameraWorldPosition: vec3f, // For specular highlights
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

  let worldPos4 = sceneUniforms.modelMatrix * vec4f(input.position_model, 1.0);
  out.world_position = worldPos4.xyz;

  let viewPos4 = sceneUniforms.viewMatrix * worldPos4;
  out.clip_position = sceneUniforms.projectionMatrix * viewPos4;
  
  // To correctly transform normals for lighting, especially with non-uniform scaling,
  // we should use the inverse transpose of the model matrix.
  // For now, we simplify and assume uniform scaling, using just the rotation part.
  // A proper solution would pass a pre-computed normalMatrix: mat3x3f.
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

  // Use the interpolated geometric normal from the model as the base for lighting.
  // The next step for ultra-realism would be to create a TBN matrix in the vertex shader
  // from the geometric normal, tangents, and bitangents, and use it here
  // to transform the tangentSpaceNormal into world space. For now, this is a good step.
  let N = normalize(input.world_normal); 

  // --- Lighting Calculation ---
  let L = normalize(lightingUniforms.lightDirection);
  let V = normalize(lightingUniforms.cameraWorldPosition - input.world_position);
  let H = normalize(L + V);

  // Ambient light
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;

  // Diffuse light (Lambertian)
  let lambertFactor = max(dot(N, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  
  // Specular light (Blinn-Phong)
  let specFactor = pow(max(dot(N, H), 0.0), 128.0); // High shininess factor
  let specular = lightingUniforms.diffuseColor.rgb * specFactor * 0.7; // Modulate specular intensity
  
  var finalRgb = ambient + diffuse + specular;

  // Simple gamma correction for a more realistic look
  finalRgb = pow(finalRgb, vec3f(1.0/2.2));

  finalRgb = clamp(finalRgb, vec3f(0.0), vec3f(1.0));

  return vec4f(finalRgb, baseAlpha);
}