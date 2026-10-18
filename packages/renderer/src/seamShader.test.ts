import { ShaderLib } from 'three';
import { describe, expect, it } from 'vitest';
import { patchSeamShader } from './seamShader.js';
import type { ShaderSource } from './shaderPatch.js';

// The physical program from the installed three.js, so an upgrade that renames
// a chunk the patch targets fails here rather than in a browser.
function patchedPhysical(seams: readonly number[]): ShaderSource {
  const shader: ShaderSource = {
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
  };
  patchSeamShader({ shader, seams });
  return shader;
}

describe('patchSeamShader', () => {
  it('passes the axial position from the vertex stage', () => {
    expect(patchedPhysical([0.6]).vertexShader).toContain('vAxis = position.y;');
  });

  it('draws one groove and one ridge per seam', () => {
    const { fragmentShader } = patchedPhysical([0.86, 0.06]);
    expect(fragmentShader).toContain('abs(axial - 0.8600)');
    expect(fragmentShader).toContain('abs(axial - 0.9200)');
    expect(fragmentShader).toContain('abs(axial - 0.0600)');
    expect(fragmentShader).toContain('abs(axial - 0.1200)');
  });

  it('keeps a ridge below the very top of the side', () => {
    expect(patchedPhysical([0.98]).fragmentShader).toContain('abs(axial - 0.9900)');
  });

  it('keeps the map lookup it extends and roughens the grooves', () => {
    const { fragmentShader } = patchedPhysical([0.6]);
    expect(fragmentShader).toContain('#include <map_fragment>');
    expect(fragmentShader).toContain('roughnessFactor + 0.28 * seamGroove');
  });

  it('throws on a program without the chunks it needs', () => {
    expect(() =>
      patchSeamShader({ shader: { vertexShader: '', fragmentShader: '' }, seams: [0.6] }),
    ).toThrow('not found');
  });
});
