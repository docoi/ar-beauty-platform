// src/shaders/lipstickEffect.wgsl

// Group 0: Scene Uniforms (for vertex shader)
// This struct receives the projection, view, and model matrices.
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms3D;
struct SceneUniforms3D {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f, 
  modelMatrix: mat4x4f,
};

// Group 1: Material Properties (for fragment shader)
// Receives the tint color, and textures/samplers for the lipstick material.
@group(1) @binding(0) var<uniform> materialUniforms: MaterialUniforms3D;
@group(1) @binding(1) var u_albedoTexture: texture_2d<f32>;
@group(1) @binding(2) var u_sampler: sampler;
@group(1) @binding(3) var u_normalTexture: texture_2d<f32>;

struct MaterialUniforms3D {
  tintColor: vec4f,
};

// Group 2: Lighting Properties (for fragment shader)
// Receives lighting information like light direction and colors.
@group(2) @binding(0) var<uniform> lightingUniforms: LightingParams3D;
struct LightingParams3D {
  lightDirection: vec3f,
  // Note: vec3 is padded to 16 bytes in the JS buffer, creating a 4-byte gap here.
  ambientColor: vec4f,
  diffuseColor: vec4f,
  cameraWorldPosition: vec3f,
  // And another 4-byte gap here for alignment.
};

// Defines the vertex attributes coming from the GPU buffer.
struct VertexInput3D {
  @location(0) position_model: vec3f, // Vertex position in its own model space
  @location(1) normal_model: vec3f,   // Vertex normal in model space
  @location(2) uv_in: vec2f,          // Texture coordinates
};

// Defines the data interpolated from the vertex shader and passed to the fragment shader.
struct VertexOutput3D {
  @builtin(position) clip_position: vec4f, // The final position in clip space
  @location(0) uv: vec2f,
  @location(1) world_normal: vec3f,        // The normal vector in world space
  @location(2) world_position: vec3f,      // The vertex position in world space
};

// Main Vertex Shader for the 3D Model
@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;

  // Transform the model's vertex position into world space using the model matrix.
  let worldPos4 = sceneUniforms.modelMatrix * vec4f(input.position_model, 1.0);
  out.world_position = worldPos4.xyz;

  // Transform the world position into view space, then into clip space.
  let viewPos4 = sceneUniforms.viewMatrix * worldPos4;
  out.clip_position = sceneUniforms.projectionMatrix * viewPos4;
  
  // To correctly transform normals for lighting, we should use the inverse transpose of the model matrix.
  // For now, we simplify and assume uniform scaling, which allows using the model matrix's rotation part.
  // A proper solution passes a pre-computed mat3x3f normalMatrix.
  out.world_normal = normalize((sceneUniforms.modelMatrix * vec4f(input.normal_model, 0.0)).xyz);
  
  // Pass the texture coordinates through to the fragment shader.
  out.uv = input.uv_in;

  return out;
}

// Main Fragment Shader for the 3D Model
@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  // Sample textures
  let albedoSample = textureSample(u_albedoTexture, u_sampler, input.uv);
  let normalMapSample = textureSample(u_normalTexture, u_sampler, input.uv).rgb;

  // Combine albedo texture with tint color from the color swatch
  let baseColor = albedoSample.rgb * materialUniforms.tintColor.rgb;
  let baseAlpha = albedoSample.a * materialUniforms.tintColor.a;

  // --- Normal Processing ---
  // For now, we will use the model's geometric normal for lighting stability.
  // The next step for more realism would be to incorporate the normal map here.
  let N = normalize(input.world_normal); 

  // To use the normal map (once the geometry is stable):
  // 1. Remap from [0,1] texture range to [-1,1] vector range:
  //    let tangentSpaceNormal = normalize((normalMapSample * 2.0) - 1.0);
  // 2. Build TBN matrix in vertex shader and pass it here.
  // 3. Transform tangentSpaceNormal by TBN matrix to get world-space normal.
  //    let N_from_map = normalize(tbnMatrix * tangentSpaceNormal);
  //    let N = N_from_map;

  // --- Lighting Calculation ---
  let L = normalize(lightingUniforms.lightDirection); // Direction TO the light
  let V = normalize(lightingUniforms.cameraWorldPosition - input.world_position); // Direction TO the camera
  let H = normalize(L + V); // Halfway vector for Blinn-Phong specular

  // Ambient light provides overall base illumination.
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;

  // Diffuse light depends on the angle between the surface and the light.
  let lambertFactor = max(dot(N, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  
  // Specular light creates shiny highlights.
  let specFactor = pow(max(dot(N, H), 0.0), 128.0); // High shininess factor for a glossy look
  let specular = lightingUniforms.diffuseColor.rgb * specFactor * 0.7; // Modulate specular intensity
  
  var finalRgb = ambient + diffuse + specular;

  // Apply a simple gamma correction for more natural-looking colors.
  finalRgb = pow(finalRgb, vec3f(1.0/2.2));

  // Clamp the final color to ensure it's within the valid [0,1] range.
  finalRgb = clamp(finalRgb, vec3f(0.0), vec3f(1.0));

  return vec4f(finalRgb, baseAlpha);
}