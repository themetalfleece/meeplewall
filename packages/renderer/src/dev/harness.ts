import { mountGameBox } from '../index.js';
import type { CameraPosition, GameBoxInput } from '../types.js';

// The same record and viewpoint the legacy practice page hardcodes, so the two
// panes of dev.html render the same box from the same camera.
const TEXTURES = '/textures/the-lord-of-the-rings-fate-of-the-fellowship-436217';

const GAME: GameBoxInput = {
  size: { width: 270, height: 310, depth: 90 },
  covers: {
    front: `${TEXTURES}/cover.webp`,
    back: `${TEXTURES}/back.webp`,
    spine: `${TEXTURES}/spine.webp`,
    top: `${TEXTURES}/top.webp`,
    bottom: `${TEXTURES}/bottom.webp`,
  },
  sideColor: '#182828',
  edgeColor: '#0e1818',
  coverAspect: 1417 / 1200,
};

const DEFAULT_YAW = -0.5;
const DEFAULT_CAMERA: CameraPosition = { x: 3, y: 2.1, z: 6.2 };

/** Reads `?cam=x,y,z`, the same format the practice page takes. */
function parseCamera(value: string | null): CameraPosition {
  const [x, y, z] = (value ?? '').split(',').map(Number);
  if (x === undefined || y === undefined || z === undefined) return DEFAULT_CAMERA;
  if (![x, y, z].every(Number.isFinite)) return DEFAULT_CAMERA;

  return { x, y, z };
}

/** Reads `?yaw=<radians>`, the same format the practice page takes. */
function parseYaw(value: string | null): number {
  const yaw = Number(value ?? DEFAULT_YAW);
  return Number.isFinite(yaw) ? yaw : DEFAULT_YAW;
}

const element = document.getElementById('renderer');
const legacy = document.getElementById('legacy');
if (!element || !(legacy instanceof HTMLIFrameElement)) {
  throw new Error('dev.html is missing the #renderer pane or the #legacy frame');
}

// Both panes are frozen at one angle so a screenshot compares like with like.
// `?spin` lets the new renderer idle-spin for a look at motion and aliasing.
const query = new URLSearchParams(window.location.search);
const yaw = parseYaw(query.get('yaw'));
const camera = parseCamera(query.get('cam'));

legacy.src = `/practice/index.html?yaw=${yaw}&cam=${camera.x},${camera.y},${camera.z}`;

mountGameBox({
  element,
  game: GAME,
  options: {
    autoRotate: query.has('spin'),
    yaw,
    cameraPosition: camera,
    onLoad: ({ failedFaces }) => {
      // Read by the smoke test to know when the frame is final.
      document.body.dataset.rendererLoaded =
        failedFaces.length === 0 ? 'ok' : failedFaces.join(',');
    },
  },
});
