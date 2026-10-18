import { replaceChunk, type ShaderSource } from './boxShader.js';

// GLSL patches that cut parting lines around a cylinder's side: a lift-off tin
// lid, a tube's cap. Each seam is a dark groove with a bright ridge just above,
// faked in tone so it needs no extra geometry.

const VERTEX_DECLARATIONS = `#include <common>
varying float vAxis;`;

const VERTEX_POSITION = `#include <begin_vertex>
vAxis = position.y;`;

const FRAGMENT_DECLARATIONS = `#include <common>
varying float vAxis;
uniform float uHalfHeight;
float seamGroove = 0.0;`;

const FRAGMENT_ROUGHNESS = `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + 0.28 * seamGroove, 0.05, 1.0);`;

/** The GLSL that shades one seam at `position` along the axis, 0 at the base and 1 at the lid. */
function seamRing(position: number): string {
  const ridge = Math.min(position + 0.06, 0.99);
  return `{
  float groove = smoothstep(0.014, 0.0, abs(axial - ${position.toFixed(4)}));
  float ridge = smoothstep(0.012, 0.0, abs(axial - ${ridge.toFixed(4)}));
  seamGroove = max(seamGroove, groove);
  diffuseColor.rgb *= 1.0 - 0.5 * groove;
  diffuseColor.rgb += 0.12 * ridge * diffuseColor.rgb;
}`;
}

/**
 * Patches a MeshPhysicalMaterial program to draw seams at `seams`, positions
 * along the axis from 0 (base) to 1 (lid). Reads `uHalfHeight`, which the
 * caller supplies. Throws when a target chunk is missing, like `patchBoxShader`.
 */
export function patchSeamShader({
  shader,
  seams,
}: {
  shader: ShaderSource;
  seams: readonly number[];
}): void {
  const albedo = `#include <map_fragment>
float axial = vAxis / uHalfHeight * 0.5 + 0.5;
${seams.map(seamRing).join('\n')}`;

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
  shader.fragmentShader = replaceChunk({
    source: shader.fragmentShader,
    chunk: '#include <common>',
    replacement: FRAGMENT_DECLARATIONS,
  });
  shader.fragmentShader = replaceChunk({
    source: shader.fragmentShader,
    chunk: '#include <map_fragment>',
    replacement: albedo,
  });
  shader.fragmentShader = replaceChunk({
    source: shader.fragmentShader,
    chunk: '#include <roughnessmap_fragment>',
    replacement: FRAGMENT_ROUGHNESS,
  });
}
