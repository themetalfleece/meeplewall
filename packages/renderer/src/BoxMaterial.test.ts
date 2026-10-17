// @vitest-environment jsdom
import { Texture, TextureLoader } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxMaterial } from './BoxMaterial.js';
import type { GameBoxInput, GameBoxLoadResult } from './types.js';

interface PendingLoad {
  url: string;
  succeed: () => void;
  fail: () => void;
}

let pendingLoads: PendingLoad[];

beforeEach(() => {
  pendingLoads = [];
  vi.spyOn(TextureLoader.prototype, 'load').mockImplementation(
    (url, onLoad, _progress, onError) => {
      const texture = new Texture(document.createElement('img'));
      pendingLoads.push({
        url,
        succeed: () => onLoad?.(texture),
        fail: () => onError?.(new Error(`failed ${url}`)),
      });
      return texture;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function settle({ url, outcome }: { url: string; outcome: 'succeed' | 'fail' }): void {
  const load = pendingLoads.find((each) => each.url === url);
  if (!load) throw new Error(`No load in flight for ${url}`);
  load[outcome]();
}

function createMaterial(onLoad: (result: GameBoxLoadResult) => void): BoxMaterial {
  return new BoxMaterial({ anisotropy: 1, onFrontAspect: vi.fn(), onLoad });
}

const gameWithBack: GameBoxInput = {
  size: { width: 270, height: 310, depth: 90 },
  covers: { front: '/a/front.webp', back: '/a/back.webp' },
  sideColor: '#182828',
  edgeColor: '#0e1818',
};
const gameWithoutBack: GameBoxInput = { ...gameWithBack, covers: { front: '/b/front.webp' } };

describe('BoxMaterial load reporting', () => {
  it('reports once every requested face has settled', () => {
    const onLoad = vi.fn<(result: GameBoxLoadResult) => void>();
    const material = createMaterial(onLoad);
    material.setGame(gameWithBack);

    settle({ url: '/a/front.webp', outcome: 'succeed' });
    expect(onLoad).not.toHaveBeenCalled();

    settle({ url: '/a/back.webp', outcome: 'fail' });
    expect(onLoad).toHaveBeenCalledWith({ failedFaces: ['back'] });
  });

  it('still reports after a face that was loading is dropped by the next game', () => {
    const onLoad = vi.fn<(result: GameBoxLoadResult) => void>();
    const material = createMaterial(onLoad);
    material.setGame(gameWithBack);
    material.setGame(gameWithoutBack);

    settle({ url: '/a/back.webp', outcome: 'succeed' });
    settle({ url: '/b/front.webp', outcome: 'succeed' });

    expect(onLoad).toHaveBeenCalledWith({ failedFaces: [] });
  });

  it('forgets a failed face that the next game does not ask for', () => {
    const onLoad = vi.fn<(result: GameBoxLoadResult) => void>();
    const material = createMaterial(onLoad);
    material.setGame(gameWithBack);
    settle({ url: '/a/front.webp', outcome: 'succeed' });
    settle({ url: '/a/back.webp', outcome: 'fail' });

    material.setGame(gameWithoutBack);
    settle({ url: '/b/front.webp', outcome: 'succeed' });

    expect(onLoad).toHaveBeenLastCalledWith({ failedFaces: [] });
  });

  it('reports when the next game drops the only face still loading', () => {
    const onLoad = vi.fn<(result: GameBoxLoadResult) => void>();
    const material = createMaterial(onLoad);
    material.setGame(gameWithBack);
    settle({ url: '/a/front.webp', outcome: 'succeed' });

    material.setGame({ ...gameWithBack, covers: { front: '/a/front.webp' } });

    expect(onLoad).toHaveBeenCalledWith({ failedFaces: [] });
  });

  it('stays quiet when an update changes nothing that was loading', () => {
    const onLoad = vi.fn<(result: GameBoxLoadResult) => void>();
    const material = createMaterial(onLoad);
    material.setGame(gameWithBack);
    settle({ url: '/a/front.webp', outcome: 'succeed' });
    settle({ url: '/a/back.webp', outcome: 'succeed' });
    onLoad.mockClear();

    material.setGame({ ...gameWithBack, sideColor: '#ffffff' });

    expect(onLoad).not.toHaveBeenCalled();
  });

  it('ignores a stale load that settles after the face moved on', () => {
    const onLoad = vi.fn<(result: GameBoxLoadResult) => void>();
    const material = createMaterial(onLoad);
    material.setGame(gameWithBack);
    material.setGame({ ...gameWithBack, covers: { front: '/a/front.webp', back: '/c/back.webp' } });

    settle({ url: '/a/back.webp', outcome: 'fail' });
    settle({ url: '/a/front.webp', outcome: 'succeed' });
    expect(onLoad).not.toHaveBeenCalled();

    settle({ url: '/c/back.webp', outcome: 'succeed' });
    expect(onLoad).toHaveBeenCalledWith({ failedFaces: [] });
  });
});
