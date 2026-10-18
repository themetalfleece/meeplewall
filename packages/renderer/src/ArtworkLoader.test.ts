// @vitest-environment jsdom
import { Texture, TextureLoader } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkLoader, imageAspect } from './ArtworkLoader.js';

type Artwork = 'front' | 'back';

interface PendingLoad {
  url: string;
  texture: Texture<HTMLImageElement>;
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
        texture,
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

function pendingLoad(url: string): PendingLoad {
  const load = pendingLoads.find((each) => each.url === url);
  if (!load) throw new Error(`No load in flight for ${url}`);
  return load;
}

function settle({ url, outcome }: { url: string; outcome: 'succeed' | 'fail' }): void {
  pendingLoad(url)[outcome]();
}

function createLoader({
  onSettled = vi.fn(),
  onTexture = vi.fn(),
}: {
  onSettled?: (failed: Artwork[]) => void;
  onTexture?: ConstructorParameters<typeof ArtworkLoader<Artwork>>[0]['onTexture'];
} = {}): ArtworkLoader<Artwork> {
  return new ArtworkLoader<Artwork>({
    artworks: ['front', 'back'],
    anisotropy: 1,
    onTexture,
    onSettled,
  });
}

const withBack = { front: '/a/front.webp', back: '/a/back.webp' };
const withoutBack = { front: '/b/front.webp' };

describe('ArtworkLoader load reporting', () => {
  it('reports once every requested key has settled', () => {
    const onSettled = vi.fn<(failed: Artwork[]) => void>();
    const loader = createLoader({ onSettled });
    loader.setUrls(withBack);

    settle({ url: '/a/front.webp', outcome: 'succeed' });
    expect(onSettled).not.toHaveBeenCalled();

    settle({ url: '/a/back.webp', outcome: 'fail' });
    expect(onSettled).toHaveBeenCalledWith(['back']);
  });

  it('still reports after a key that was loading is dropped by the next set', () => {
    const onSettled = vi.fn<(failed: Artwork[]) => void>();
    const loader = createLoader({ onSettled });
    loader.setUrls(withBack);
    loader.setUrls(withoutBack);

    settle({ url: '/a/back.webp', outcome: 'succeed' });
    settle({ url: '/b/front.webp', outcome: 'succeed' });

    expect(onSettled).toHaveBeenCalledWith([]);
  });

  it('forgets a failed key that the next set does not ask for', () => {
    const onSettled = vi.fn<(failed: Artwork[]) => void>();
    const loader = createLoader({ onSettled });
    loader.setUrls(withBack);
    settle({ url: '/a/front.webp', outcome: 'succeed' });
    settle({ url: '/a/back.webp', outcome: 'fail' });

    loader.setUrls(withoutBack);
    settle({ url: '/b/front.webp', outcome: 'succeed' });

    expect(onSettled).toHaveBeenLastCalledWith([]);
  });

  it('reports when the next set drops the only key still loading', () => {
    const onSettled = vi.fn<(failed: Artwork[]) => void>();
    const loader = createLoader({ onSettled });
    loader.setUrls(withBack);
    settle({ url: '/a/front.webp', outcome: 'succeed' });

    loader.setUrls({ front: '/a/front.webp' });

    expect(onSettled).toHaveBeenCalledWith([]);
  });

  it('stays quiet when a set changes nothing that was loading', () => {
    const onSettled = vi.fn<(failed: Artwork[]) => void>();
    const loader = createLoader({ onSettled });
    loader.setUrls(withBack);
    settle({ url: '/a/front.webp', outcome: 'succeed' });
    settle({ url: '/a/back.webp', outcome: 'succeed' });
    onSettled.mockClear();

    loader.setUrls({ ...withBack });

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('ignores a stale load that settles after the key moved on', () => {
    const onSettled = vi.fn<(failed: Artwork[]) => void>();
    const loader = createLoader({ onSettled });
    loader.setUrls(withBack);
    loader.setUrls({ front: '/a/front.webp', back: '/c/back.webp' });

    settle({ url: '/a/back.webp', outcome: 'fail' });
    settle({ url: '/a/front.webp', outcome: 'succeed' });
    expect(onSettled).not.toHaveBeenCalled();

    settle({ url: '/c/back.webp', outcome: 'succeed' });
    expect(onSettled).toHaveBeenCalledWith([]);
  });
});

describe('ArtworkLoader textures', () => {
  it('hands over a loaded texture and keeps it until the URL changes', () => {
    const onTexture = vi.fn();
    const loader = createLoader({ onTexture });
    loader.setUrls(withoutBack);
    expect(onTexture).toHaveBeenCalledWith({ artwork: 'front', texture: null });

    settle({ url: '/b/front.webp', outcome: 'succeed' });
    const { texture } = pendingLoad('/b/front.webp');
    expect(onTexture).toHaveBeenLastCalledWith({ artwork: 'front', texture });
    expect(loader.texture('front')).toBe(texture);
    expect(loader.texture('back')).toBeNull();

    const dispose = vi.spyOn(texture, 'dispose');
    loader.setUrls({ front: '/c/front.webp' });
    expect(dispose).toHaveBeenCalled();
    expect(loader.texture('front')).toBeNull();
    expect(onTexture).toHaveBeenLastCalledWith({ artwork: 'front', texture: null });
  });

  it('disposes a load that arrives after the loader was disposed', () => {
    const onTexture = vi.fn();
    const loader = createLoader({ onTexture });
    loader.setUrls(withoutBack);
    onTexture.mockClear();
    loader.dispose();

    const { texture } = pendingLoad('/b/front.webp');
    const dispose = vi.spyOn(texture, 'dispose');
    settle({ url: '/b/front.webp', outcome: 'succeed' });

    expect(dispose).toHaveBeenCalled();
    expect(onTexture).not.toHaveBeenCalled();
  });
});

describe('imageAspect', () => {
  function textureOf({
    width,
    height,
  }: {
    width: number;
    height: number;
  }): Texture<HTMLImageElement> {
    const image = document.createElement('img');
    Object.defineProperty(image, 'naturalWidth', { value: width });
    Object.defineProperty(image, 'naturalHeight', { value: height });
    return new Texture(image);
  }

  it('divides the natural width by the natural height', () => {
    expect(imageAspect(textureOf({ width: 1417, height: 1200 }))).toBeCloseTo(1417 / 1200);
  });

  it('falls back to square before the image has a size', () => {
    expect(imageAspect(textureOf({ width: 0, height: 0 }))).toBe(1);
  });
});
