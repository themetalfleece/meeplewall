import { describe, expect, it } from 'vitest';
import { patchShader, replaceChunk } from './shaderPatch.js';

describe('replaceChunk', () => {
  it('replaces the first occurrence only', () => {
    expect(replaceChunk({ source: 'a #x b #x', chunk: '#x', replacement: 'y' })).toBe('a y b #x');
  });

  it('throws when the chunk is missing', () => {
    expect(() => replaceChunk({ source: 'void main() {}', chunk: '#x', replacement: 'y' })).toThrow(
      'Shader chunk "#x" not found',
    );
  });
});

describe('patchShader', () => {
  it('applies each stage its own replacements, in order', () => {
    const shader = { vertexShader: '#a', fragmentShader: '#a' };
    patchShader({
      shader,
      vertex: [
        { chunk: '#a', replacement: '#b' },
        { chunk: '#b', replacement: 'vertex' },
      ],
      fragment: [{ chunk: '#a', replacement: 'fragment' }],
    });

    expect(shader).toEqual({ vertexShader: 'vertex', fragmentShader: 'fragment' });
  });

  it('leaves a stage with no replacements untouched', () => {
    const shader = { vertexShader: '#a', fragmentShader: '#a' };
    patchShader({ shader, vertex: [], fragment: [] });

    expect(shader).toEqual({ vertexShader: '#a', fragmentShader: '#a' });
  });

  it('throws when a stage lacks a chunk it targets', () => {
    const shader = { vertexShader: '#a', fragmentShader: '' };
    expect(() =>
      patchShader({ shader, vertex: [], fragment: [{ chunk: '#a', replacement: 'x' }] }),
    ).toThrow('Shader chunk "#a" not found');
  });
});
