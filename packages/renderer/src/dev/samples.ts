import type { GameBoxInput } from '../types.js';

/** A harness sample: the game to draw and the legacy game id it is compared with. */
export interface HarnessSample {
  legacyId: string;
  game: GameBoxInput;
}

function covers(id: string): GameBoxInput['covers'] {
  const textures = `/textures/${id}`;
  return {
    front: `${textures}/cover.webp`,
    back: `${textures}/back.webp`,
    spine: `${textures}/spine.webp`,
    top: `${textures}/top.webp`,
    bottom: `${textures}/bottom.webp`,
  };
}

// Records copied from the legacy app's game data, converted to millimetres.
const HAPPY_SALMON_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [0.867, 0.003],
  [0.895, 0.038],
  [0.914, 0.125],
  [0.914, 0.203],
  [0.895, 0.294],
  [0.942, 0.328],
  [0.969, 0.369],
  [0.984, 0.413],
  [0.995, 0.485],
  [0.914, 0.494],
  [0.877, 0.506],
  [0.851, 0.526],
  [0.814, 0.578],
  [0.778, 0.657],
  [0.756, 0.677],
  [0.746, 0.738],
  [0.731, 0.785],
  [0.736, 0.794],
  [0.764, 0.77],
  [0.83, 0.686],
  [0.85, 0.686],
  [0.874, 0.73],
  [0.866, 0.765],
  [0.866, 0.788],
  [0.874, 0.802],
  [0.922, 0.826],
  [0.947, 0.852],
  [0.85, 0.849],
  [0.796, 0.863],
  [0.731, 0.904],
  [0.699, 0.945],
  [0.605, 0.997],
  [0.417, 0.997],
  [0.413, 0.988],
  [0.406, 0.994],
  [0.28, 0.968],
  [0.142, 0.922],
  [0.087, 0.875],
  [0.061, 0.84],
  [0.016, 0.735],
  [0.034, 0.715],
  [0.081, 0.706],
  [0.087, 0.695],
  [0.076, 0.59],
  [0.05, 0.5],
  [0.049, 0.427],
  [0.06, 0.372],
  [0.1, 0.314],
  [0.165, 0.305],
  [0.222, 0.32],
  [0.312, 0.363],
  [0.328, 0.355],
  [0.34, 0.366],
  [0.448, 0.395],
  [0.489, 0.39],
  [0.51, 0.445],
  [0.629, 0.459],
  [0.639, 0.451],
  [0.649, 0.459],
  [0.701, 0.462],
  [0.714, 0.474],
  [0.83, 0.154],
  [0.867, 0.006],
];

export const SAMPLES = {
  // The practice page's own box, so this one is compared with the practice page.
  box: {
    legacyId: 'the-lord-of-the-rings-fate-of-the-fellowship-436217',
    game: {
      size: { width: 270, height: 310, depth: 90 },
      covers: covers('the-lord-of-the-rings-fate-of-the-fellowship-436217'),
      sideColor: '#182828',
      edgeColor: '#0e1818',
      coverAspect: 1417 / 1200,
    },
  },
  'hang-tab': {
    legacyId: 'uno-2223',
    game: {
      shape: {
        kind: 'box',
        hangTab: {
          url: '/textures/uno-2223/flap.webp',
          heightFraction: 0.176,
          widthFraction: 0.7,
          cornerRadius: 0.42,
          hole: { left: 0.28, top: 0.48, right: 0.68, bottom: 0.79, circleRadius: 0.16 },
        },
      },
      size: { width: 94, height: 127, depth: 20 },
      covers: covers('uno-2223'),
      sideColor: '#d82818',
      edgeColor: '#82180e',
    },
  },
  'rect-tin': {
    legacyId: 'sushi-go-133473',
    game: {
      shape: { kind: 'rect-tin', cornerRadius: 0.155 },
      size: { width: 102, height: 143, depth: 38 },
      covers: covers('sushi-go-133473'),
      sideColor: '#181818',
      edgeColor: '#0e0e0e',
    },
  },
  'round-tin': {
    legacyId: 'dobble-63268',
    game: {
      shape: {
        kind: 'round-tin',
        diameter: 130,
        height: 45,
        label: '/textures/dobble-63268/cyl.webp',
      },
      size: { width: 130, height: 130, depth: 50 },
      covers: covers('dobble-63268'),
      sideColor: '#a59339',
      edgeColor: '#635822',
    },
  },
  tube: {
    legacyId: 'zombie-dice-horde-edition-224035',
    game: {
      shape: {
        kind: 'tube',
        diameter: 90,
        height: 150,
        label: '/textures/zombie-dice-horde-edition-224035/cyl.webp',
      },
      size: { width: 148, height: 212, depth: 56 },
      covers: covers('zombie-dice-horde-edition-224035'),
      sideColor: '#614b46',
      edgeColor: '#3a2d2a',
    },
  },
  // Legacy draws this game from a glTF model, so expect the shapes to differ.
  'foil-bag': {
    legacyId: 'bag-of-chips-344114',
    game: {
      shape: { kind: 'foil-bag' },
      size: { width: 140, height: 200, depth: 30 },
      covers: covers('bag-of-chips-344114'),
      sideColor: '#c81808',
      edgeColor: '#780e05',
    },
  },
  pouch: {
    legacyId: 'happy-salmon-194626',
    game: {
      shape: {
        kind: 'pouch',
        cutout: '/textures/happy-salmon-194626/cutout.webp',
        outline: { aspect: 1.797, points: HAPPY_SALMON_OUTLINE },
      },
      size: { width: 145, height: 215, depth: 49 },
      covers: covers('happy-salmon-194626'),
      sideColor: '#9b9f85',
      edgeColor: '#5d5f50',
    },
  },
} satisfies Record<string, HarnessSample>;

export type SampleName = keyof typeof SAMPLES;

export function isSampleName(value: string): value is SampleName {
  return Object.hasOwn(SAMPLES, value);
}
