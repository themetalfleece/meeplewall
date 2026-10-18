import { ClampToEdgeWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three';

interface ArtworkSlot {
  url: string | undefined;
  /** Loaded texture for `url`, or null while loading, after a failure, or with no URL. */
  texture: Texture<HTMLImageElement> | null;
}

/**
 * Loads one image per artwork key, drops results for a URL that has since
 * changed, and reports once nothing is still in flight. Owns every texture it loads.
 */
export class ArtworkLoader<Artwork extends string> {
  readonly #artworks: readonly Artwork[];
  readonly #slots = new Map<Artwork, ArtworkSlot>();
  readonly #loader = new TextureLoader();
  readonly #anisotropy: number;
  readonly #onTexture: (change: {
    artwork: Artwork;
    texture: Texture<HTMLImageElement> | null;
  }) => void;
  readonly #onSettled: (failed: Artwork[]) => void;
  readonly #pending = new Set<Artwork>();
  readonly #failed = new Set<Artwork>();
  #disposed = false;

  constructor({
    artworks,
    anisotropy,
    onTexture,
    onSettled,
  }: {
    /** Every key, in the order failures are reported. */
    artworks: readonly Artwork[];
    anisotropy: number;
    /** Called when a key's texture arrives, or with null when its URL changes. */
    onTexture: (change: { artwork: Artwork; texture: Texture<HTMLImageElement> | null }) => void;
    onSettled: (failed: Artwork[]) => void;
  }) {
    this.#artworks = artworks;
    this.#anisotropy = anisotropy;
    this.#onTexture = onTexture;
    this.#onSettled = onSettled;
    for (const artwork of artworks) this.#slots.set(artwork, { url: undefined, texture: null });
  }

  texture(artwork: Artwork): Texture<HTMLImageElement> | null {
    return this.#slot(artwork).texture;
  }

  /** Starts loading every URL that changed. A key left out is cleared. */
  setUrls(urls: Partial<Record<Artwork, string>>): void {
    const wasLoading = this.#pending.size > 0;

    for (const artwork of this.#artworks) {
      const slot = this.#slot(artwork);
      const url = urls[artwork];
      if (url === slot.url) continue;

      slot.texture?.dispose();
      slot.texture = null;
      slot.url = url;
      // The previous URL's load state no longer applies, whether or not a new load starts.
      this.#pending.delete(artwork);
      this.#failed.delete(artwork);
      this.#onTexture({ artwork, texture: null });
      if (url !== undefined) this.#load({ artwork, url });
    }

    // Dropping the last key still in flight settles the batch without a load callback.
    if (wasLoading) this.#reportIfSettled();
  }

  dispose(): void {
    this.#disposed = true;
    for (const slot of this.#slots.values()) slot.texture?.dispose();
  }

  #slot(artwork: Artwork): ArtworkSlot {
    const slot = this.#slots.get(artwork);
    if (!slot) throw new Error(`Unknown artwork key: ${artwork}`);

    return slot;
  }

  #load({ artwork, url }: { artwork: Artwork; url: string }): void {
    this.#pending.add(artwork);

    this.#loader.load(
      url,
      (texture) => {
        const slot = this.#slot(artwork);
        if (this.#disposed || slot.url !== url) {
          texture.dispose();
          return;
        }

        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = this.#anisotropy;
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        slot.texture = texture;
        this.#onTexture({ artwork, texture });
        this.#settle({ artwork, url, failed: false });
      },
      undefined,
      () => this.#settle({ artwork, url, failed: true }),
    );
  }

  /** Records a finished load and reports once nothing is still in flight. */
  #settle({ artwork, url, failed }: { artwork: Artwork; url: string; failed: boolean }): void {
    if (this.#disposed || this.#slot(artwork).url !== url) return;

    this.#pending.delete(artwork);
    if (failed) this.#failed.add(artwork);
    this.#reportIfSettled();
  }

  #reportIfSettled(): void {
    if (this.#pending.size > 0) return;

    this.#onSettled(this.#artworks.filter((each) => this.#failed.has(each)));
  }
}

/** Width over height of a loaded image, or 1 before it has a size. */
export function imageAspect(texture: Texture<HTMLImageElement>): number {
  const { naturalWidth, naturalHeight } = texture.image;
  return naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
}
