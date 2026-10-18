import type { WebGLProgramParametersWithUniforms } from 'three';

/** The part of a compiling program a patch rewrites. */
export type ShaderSource = Pick<
  WebGLProgramParametersWithUniforms,
  'vertexShader' | 'fragmentShader'
>;

/** A shader chunk and the GLSL that takes its place. */
export interface ChunkReplacement {
  chunk: string;
  replacement: string;
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

/** Applies each stage's replacements in order. Throws when any target chunk is missing. */
export function patchShader({
  shader,
  vertex,
  fragment,
}: {
  shader: ShaderSource;
  vertex: readonly ChunkReplacement[];
  fragment: readonly ChunkReplacement[];
}): void {
  shader.vertexShader = replaceChunks({ source: shader.vertexShader, replacements: vertex });
  shader.fragmentShader = replaceChunks({ source: shader.fragmentShader, replacements: fragment });
}

function replaceChunks({
  source,
  replacements,
}: {
  source: string;
  replacements: readonly ChunkReplacement[];
}): string {
  return replacements.reduce(
    (patched, { chunk, replacement }) => replaceChunk({ source: patched, chunk, replacement }),
    source,
  );
}
