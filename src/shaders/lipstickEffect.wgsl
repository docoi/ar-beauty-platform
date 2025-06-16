// src/shaders/lipstickEffect.wgsl

// Group 0: Scene Uniforms (for vertex shader)
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms3D;
struct SceneUniforms3D {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f, 
  modelMatrix: mat4x4f,
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
  lightDirection: vec3f,
  // Note: vec3 is padded to 16 bytes in JS, so there's a 4-byte gap here
  ambientColor: vec4f,
  diffuseColor: vec4f,
  cameraWorldPosition: vec3f,
  // And another 4-byte gap here
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
  
  // To correctly transform normals, a mat3x3f normalMatrix (inverse transpose of model) is best.
  // For now, assuming uniform scaling allows this simplification.
  out.world_normal = normalize((sceneUniforms.modelMatrix * vec4f(input.normal_model, 0.0)).xyz);
  
  out.uv = input.uv_in;

  return out;
}

@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  let albedoSample = textureSample(u_albedoTexture, u_sampler, input.uv);
  let baseColor = albedoSample.rgb * materialUniforms.tintColor.rgb;
  let baseAlpha = albedoSample.a * materialUniforms.tintColor.a;

  // For this test, we will use the geometric normal from the model for lighting stability.
  // The next step for more realism would be to use the normal map.
  let N = normalize(input.world_normal); 

  let L = normalize(lightingUniforms.lightDirection);
  let V = normalize(lightingUniforms.cameraWorldPosition - input.world_position);
  let H = normalize(L + V);

  let ambient = lightingUniforms.ambientColor.rgb * baseColor;
  let lambertFactor = max(dot(N, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  
  let specFactor = pow(max(dot(N, H), 0.0), 128.0);
  let specular = lightingUniforms.diffuseColor.rgb * specFactor * 0.7;
  
  var finalRgb = ambient + diffuse + specular;
  finalRgb = pow(finalRgb, vec3f(1.0/2.2));
  finalRgb = clamp(finalRgb, vec3f(0.0), vec3f(1.0));

  return vec4f(finalRgb, baseAlpha);
}