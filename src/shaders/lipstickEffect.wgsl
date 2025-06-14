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
  direction: vec3f, 
  ambientColor: vec4f,
  diffuseColor: vec4f,
};


// Input attributes for the 3D model's vertex shader
struct VertexInput3D {
  @location(0) position_model: vec3f, // Vertex position in model space
  @location(1) normal_model: vec3f,   // Vertex normal in model space
  @location(2) uv_in: vec2f,          // Vertex UV coordinates
};

// Data passed from vertex shader to fragment shader
struct VertexOutput3D {
  @builtin(position) clip_position: vec4f,
  @location(0) uv: vec2f,
  @location(1) world_normal: vec3f,
  @location(2) world_position: vec3f,
};

// --- Vertex Shader for 3D Model ---
@vertex
fn vert_main_3d(input: VertexInput3D) -> VertexOutput3D {
  var out: VertexOutput3D;

  // Calculate world position
  let worldPos4 = sceneUniforms.modelMatrix * vec4f(input.position_model, 1.0);
  out.world_position = worldPos4.xyz;

  // Calculate clip space position
  let viewPos4 = sceneUniforms.viewMatrix * worldPos4;
  out.clip_position = sceneUniforms.projectionMatrix * viewPos4;
  
  // Calculate world normal
  // Use inverse-transpose of model matrix for normals to handle non-uniform scaling correctly.
  // For now, we assume uniform scaling and just use the model matrix's rotation part.
  // This is a common simplification but can be improved.
  // A proper solution would be to pass a pre-computed normalMatrix.
  out.world_normal = normalize((sceneUniforms.modelMatrix * vec4f(input.normal_model, 0.0)).xyz);
  
  // Pass through UV coordinates
  out.uv = input.uv_in;

  return out;
}

// --- Fragment Shader for 3D Model (Full PBR-like shading) ---
@fragment
fn frag_main_3d(input: VertexOutput3D) -> @location(0) vec4f {
  // Sample the albedo (base color) texture
  let albedoSample = textureSample(u_albedoTexture, u_sampler, input.uv);
  let baseColor = albedoSample.rgb * materialUniforms.tintColor.rgb;
  let baseAlpha = albedoSample.a * materialUniforms.tintColor.a;

  // Sample the normal map and convert from [0,1] texture range to [-1,1] vector range
  let normalMapSample = textureSample(u_normalTexture, u_sampler, input.uv).rgb;
  let tangentSpaceNormal = normalize((normalMapSample * 2.0) - 1.0);

  // --- Normal Processing ---
  // For now, we are using a simplified assumption that the normal map can be used directly
  // as if it's in view/world space for a camera-facing object.
  // This is the area to improve with a full TBN matrix for perfect lighting.
  // We'll use the geometric normal passed from the vertex shader, perturbed by the map.
  // Since our base normal is just the model normal transformed, let's use that as the base.
  let N_geom = normalize(input.world_normal);

  // A very simplified perturbation. A proper implementation needs TBN matrix.
  // Let's assume the geometric normal (N_geom) is mostly pointing along some Z axis,
  // and we'll use the normal map to push it along X and Y.
  // This is a VISUAL APPROXIMATION.
  // For a robust solution, we would build a TBN matrix in the vertex shader.
  // For now, we'll try a simpler approach that may work for our setup.
  // Let's directly use the transformed geometric normal for now, and apply normal map later if this works.
  let N = N_geom; // Use the vertex normal for now to ensure lighting works first.
  
  // Once the above works, we can try to use the tangentSpaceNormal.
  // let N = tangentSpaceNormal; // This is a common "cheat" that assumes object is camera-aligned.

  // --- Lighting Calculation ---
  let L = normalize(lightingUniforms.direction.xyz); // Light direction
  let V = normalize(vec3f(0.0, 0.0, 1.0) - input.world_position); // View direction (assuming camera at 0,0,1 in view space, needs camera position uniform for world space)
  
  // Ambient light
  let ambient = lightingUniforms.ambientColor.rgb * baseColor;

  // Diffuse light (Lambertian)
  let lambertFactor = max(dot(N, L), 0.0);
  let diffuse = lightingUniforms.diffuseColor.rgb * baseColor * lambertFactor;
  
  // Specular light (Blinn-Phong)
  let H = normalize(L + V); // Halfway vector
  let specFactor = pow(max(dot(N, H), 0.0), 64.0); // 64.0 is shininess factor
  let specular = lightingUniforms.diffuseColor.rgb * specFactor; // Specular highlights are often white/light color
  
  var finalRgb = ambient + diffuse + specular;

  // Simple gamma correction approximation
  finalRgb = pow(finalRgb, vec3f(1.0/2.2));

  finalRgb = clamp(finalRgb, vec3f(0.0), vec3f(1.0));

  return vec4f(finalRgb, baseAlpha);
}