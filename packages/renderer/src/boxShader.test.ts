import { ShaderLib } from 'three';
import { describe, expect, it } from 'vitest';
import { patchBoxShader } from './boxShader.js';
import type { ShaderSource } from './shaderPatch.js';

describe('patchBoxShader', () => {
  // The physical program from the installed three.js, so an upgrade that renames
  // a chunk the patch targets fails here rather than in a browser.
  function patchedPhysical(): ShaderSource {
    const shader: ShaderSource = {
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: ShaderLib.physical.fragmentShader,
    };
    patchBoxShader(shader);
    return shader;
  }

  it('passes object-space position and normal from the vertex stage', () => {
    const { vertexShader } = patchedPhysical();
    expect(vertexShader).toContain('vObjectPosition = transformed;');
    expect(vertexShader).toContain('vObjectNormal = objectNormal;');
  });

  it('keeps the chunks it extends', () => {
    const { vertexShader, fragmentShader } = patchedPhysical();
    expect(vertexShader).toContain('#include <begin_vertex>');
    expect(vertexShader).toContain('#include <beginnormal_vertex>');
    expect(fragmentShader).toContain('#include <roughnessmap_fragment>');
  });

  it('declares a sampler and a fit for every face', () => {
    const { fragmentShader } = patchedPhysical();
    expect(fragmentShader).toContain('uniform sampler2D tFront, tBack, tSpine, tTop, tBottom;');
    expect(fragmentShader).toContain(
      'uniform vec4 uFitFront, uFitBack, uFitSpine, uFitTop, uFitBottom;',
    );
  });

  it('replaces the map lookup with the box projection', () => {
    const { fragmentShader } = patchedPhysical();
    expect(fragmentShader).not.toContain('#include <map_fragment>');
    expect(fragmentShader).toContain('diffuseColor.rgb *= faceColor.rgb;');
  });

  it('throws on a program without the chunks it needs', () => {
    expect(() => patchBoxShader({ vertexShader: 'void main() {}', fragmentShader: '' })).toThrow(
      'not found',
    );
  });
});
