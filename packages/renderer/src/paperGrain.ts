/** Edge length of the generated grain tile, in texels. */
export const PAPER_GRAIN_SIZE = 256;

const SEED = 0x2f6e2b1;
const OCTAVES = 4;

/**
 * Generates a tiling greyscale RGBA tile of fractal value noise, used as a bump
 * map so the coated card catches light unevenly. Deterministic, so every box
 * shares the same grain and screenshots are reproducible.
 */
export function generatePaperGrain(size: number = PAPER_GRAIN_SIZE): Uint8Array {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`Grain size must be a positive integer, got ${size}`);
  }

  const lattice = randomLattice(size);
  const sample = (x: number, y: number) => lattice[wrap(y, size) * size + wrap(x, size)] ?? 0;
  const smoothNoise = (x: number, y: number) => {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const fractionX = x - cellX;
    const fractionY = y - cellY;
    const top = smoothstepMix(sample(cellX, cellY), sample(cellX + 1, cellY), fractionX);
    const bottom = smoothstepMix(sample(cellX, cellY + 1), sample(cellX + 1, cellY + 1), fractionX);
    return smoothstepMix(top, bottom, fractionY);
  };

  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;
      let amplitude = 0.5;
      let frequency = size / 8;
      for (let octave = 0; octave < OCTAVES; octave++) {
        value += smoothNoise((x / size) * frequency, (y / size) * frequency) * amplitude;
        frequency *= 2;
        amplitude *= 0.5;
      }

      const level = Math.max(0, Math.min(255, Math.round(value * 255)));
      const offset = (y * size + x) * 4;
      pixels.fill(level, offset, offset + 3);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

/** Uniform values in [0, 1] from a fixed linear congruential generator. */
function randomLattice(size: number): Float32Array {
  let state = SEED;
  const lattice = new Float32Array(size * size);
  for (let index = 0; index < lattice.length; index++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    lattice[index] = state / 0x7fffffff;
  }
  return lattice;
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function smoothstepMix(from: number, to: number, amount: number): number {
  return from + (to - from) * (amount * amount * (3 - 2 * amount));
}
