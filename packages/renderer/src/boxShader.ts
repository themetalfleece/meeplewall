import type { WebGLProgramParametersWithUniforms } from 'three';

/** The part of a compiling program the patch rewrites. */
export type ShaderSource = Pick<
  WebGLProgramParametersWithUniforms,
  'vertexShader' | 'fragmentShader'
>;

// GLSL patches for MeshPhysicalMaterial. A rounded box has no clean per-face
// UVs, so the fragment stage picks each face by its dominant object-space normal
// and projects the object-space position onto that face instead.

const VERTEX_DECLARATIONS = `#include <common>
varying vec3 vObjectPosition;
varying vec3 vObjectNormal;`;

const VERTEX_POSITION = `#include <begin_vertex>
vObjectPosition = transformed;`;

const VERTEX_NORMAL = `#include <beginnormal_vertex>
vObjectNormal = objectNormal;`;

const FRAGMENT_DECLARATIONS = `#include <common>
uniform sampler2D tFront, tBack, tSpine, tTop, tBottom;
uniform vec4 uFitFront, uFitBack, uFitSpine, uFitTop, uFitBottom;
uniform vec3 uHalf;
varying vec3 vObjectPosition;
varying vec3 vObjectNormal;

float grainHash(vec3 point) {
  point = fract(point * 0.3183099 + 0.1);
  point *= 17.0;
  return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
}

float valueNoise(vec3 point) {
  vec3 cell = floor(point);
  vec3 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(
    mix(mix(grainHash(cell), grainHash(cell + vec3(1, 0, 0)), blend.x),
        mix(grainHash(cell + vec3(0, 1, 0)), grainHash(cell + vec3(1, 1, 0)), blend.x), blend.y),
    mix(mix(grainHash(cell + vec3(0, 0, 1)), grainHash(cell + vec3(1, 0, 1)), blend.x),
        mix(grainHash(cell + vec3(0, 1, 1)), grainHash(cell + vec3(1, 1, 1)), blend.x), blend.y),
    blend.z);
}

vec4 sampleFace(sampler2D map, vec4 fit, vec2 uv) {
  return texture2D(map, uv * fit.xy + fit.zw);
}

vec4 boxAlbedo() {
  vec3 normal = normalize(vObjectNormal);
  vec3 axis = abs(normal);
  vec3 point = vObjectPosition;
  vec4 albedo;

  // One assignment per branch and a single return: the HLSL backend on Windows
  // warns that an early-return chain may leave the result uninitialised.
  if (axis.z >= axis.x && axis.z >= axis.y) {
    vec2 uv = vec2(point.x / uHalf.x, point.y / uHalf.y) * 0.5 + 0.5;
    if (normal.z >= 0.0) {
      albedo = sampleFace(tFront, uFitFront, uv);
    } else {
      albedo = sampleFace(tBack, uFitBack, vec2(1.0 - uv.x, uv.y));
    }
  } else if (axis.x >= axis.y) {
    vec2 uv = vec2(point.z / uHalf.z, point.y / uHalf.y) * 0.5 + 0.5;
    if (normal.x >= 0.0) {
      albedo = sampleFace(tSpine, uFitSpine, vec2(1.0 - uv.x, uv.y));
    } else {
      albedo = sampleFace(tSpine, uFitSpine, uv);
    }
  } else {
    vec2 uv = vec2(point.x / uHalf.x, point.z / uHalf.z) * 0.5 + 0.5;
    if (normal.y >= 0.0) {
      albedo = sampleFace(tTop, uFitTop, vec2(uv.x, 1.0 - uv.y));
    } else {
      albedo = sampleFace(tBottom, uFitBottom, uv);
    }
  }

  return albedo;
}`;

const FRAGMENT_ALBEDO = `vec4 faceColor = boxAlbedo();
diffuseColor.rgb *= faceColor.rgb;`;

// Low-frequency roughness jitter, so the sheen is uneven like real coated card.
const FRAGMENT_ROUGHNESS = `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (valueNoise(vObjectPosition * 22.0) - 0.5) * 0.16, 0.05, 1.0);`;

/**
 * Patches a MeshPhysicalMaterial program in place. Every chunk it targets must
 * exist, so a three.js upgrade that renames one fails here instead of silently
 * rendering a blank box.
 */
export function patchBoxShader(shader: ShaderSource): void {
  shader.vertexShader = replaceChunk({
    source: shader.vertexShader,
    chunk: '#include <common>',
    replacement: VERTEX_DECLARATIONS,
  });
  shader.vertexShader = replaceChunk({
    source: shader.vertexShader,
    chunk: '#include <begin_vertex>',
    replacement: VERTEX_POSITION,
  });
  shader.vertexShader = replaceChunk({
    source: shader.vertexShader,
    chunk: '#include <beginnormal_vertex>',
    replacement: VERTEX_NORMAL,
  });
  shader.fragmentShader = replaceChunk({
    source: shader.fragmentShader,
    chunk: '#include <common>',
    replacement: FRAGMENT_DECLARATIONS,
  });
  shader.fragmentShader = replaceChunk({
    source: shader.fragmentShader,
    chunk: '#include <map_fragment>',
    replacement: FRAGMENT_ALBEDO,
  });
  shader.fragmentShader = replaceChunk({
    source: shader.fragmentShader,
    chunk: '#include <roughnessmap_fragment>',
    replacement: FRAGMENT_ROUGHNESS,
  });
}

/** Replaces the first occurrence of a shader chunk, throwing when it is missing. */
export function replaceChunk({
  source,
  chunk,
  replacement,
}: {
  source: string;
  chunk: string;
  replacement: string;
}): string {
  if (!source.includes(chunk)) {
    throw new Error(`Shader chunk "${chunk}" not found; the three.js shader layout has changed`);
  }

  return source.replace(chunk, replacement);
}
