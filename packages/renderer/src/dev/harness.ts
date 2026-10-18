import { DEFAULT_CAMERA, DEFAULT_YAW } from '../GameBoxScene.js';
import { mountGameBox } from '../index.js';
import type { CameraPosition } from '../types.js';
import { SAMPLES, type SampleName, isSampleName } from './samples.js';

/** The legacy Vite app, run from git history on port 5174 beside this server on 5173. */
const DEFAULT_LEGACY_ORIGIN = 'http://localhost:5174';

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

/** Reads `?shape=<sample>`, defaulting to the practice page's box. */
function parseSample(value: string | null): SampleName {
  if (value !== null && isSampleName(value)) return value;

  return 'box';
}

/**
 * The plain box is compared with the practice page from the same camera. Every
 * other shape is compared with that game's page in the running legacy app.
 */
function legacyUrl({
  sample,
  yaw,
  camera,
  legacyOrigin,
}: {
  sample: SampleName;
  yaw: number;
  camera: CameraPosition;
  legacyOrigin: string;
}): string {
  if (sample === 'box')
    return `/practice/index.html?yaw=${yaw}&cam=${camera.x},${camera.y},${camera.z}`;

  return `${legacyOrigin}/g/${SAMPLES[sample].legacyId}/`;
}

const element = document.getElementById('renderer');
const legacy = document.getElementById('legacy');
const legacyCaption = document.getElementById('legacy-caption');
if (!element || !(legacy instanceof HTMLIFrameElement) || !legacyCaption) {
  throw new Error('dev.html is missing the #renderer pane, the #legacy frame or its caption');
}

// Both panes are frozen at one angle so a screenshot compares like with like.
// `?spin` lets the new renderer idle-spin for a look at motion and aliasing.
const query = new URLSearchParams(window.location.search);
const yaw = parseYaw(query.get('yaw'));
const camera = parseCamera(query.get('cam'));
const sample = parseSample(query.get('shape'));
const legacyOrigin = query.get('legacy') ?? DEFAULT_LEGACY_ORIGIN;

legacy.src = legacyUrl({ sample, yaw, camera, legacyOrigin });
legacyCaption.textContent =
  sample === 'box' ? 'Legacy practice page' : `Legacy app: ${SAMPLES[sample].legacyId}`;

for (const link of document.querySelectorAll<HTMLAnchorElement>('nav a[data-shape]')) {
  const target = new URLSearchParams(query);
  target.set('shape', link.dataset.shape ?? 'box');
  link.href = `?${target.toString()}`;
  if (link.dataset.shape === sample) link.setAttribute('aria-current', 'page');
}

mountGameBox({
  element,
  game: SAMPLES[sample].game,
  options: {
    autoRotate: query.has('spin'),
    yaw,
    cameraPosition: camera,
    onLoad: ({ failedArtwork }) => {
      // Read by the smoke test to know when the frame is final.
      document.body.dataset.rendererLoaded =
        failedArtwork.length === 0 ? 'ok' : failedArtwork.join(',');
    },
  },
});
