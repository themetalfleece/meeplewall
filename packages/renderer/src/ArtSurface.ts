import { MeshPhysicalMaterial, type MeshPhysicalMaterialParameters, type Texture } from 'three';
import type { TextureTransform } from './packageLayout.js';

const WHITE = '#ffffff';

/**
 * A material that prints one piece of artwork, painted a stand-in colour while
 * there is none. It builds and owns its material. A transform is applied to a
 * private copy of the texture, so the shared original is never changed.
 */
export class ArtSurface {
  readonly material: MeshPhysicalMaterial;
  readonly #transform: TextureTransform | null;
  #ownedCopy: Texture | null = null;
  #hasArtwork = false;
  #fallbackColor = WHITE;

  constructor({
    materialParameters,
    transform = null,
  }: {
    materialParameters: MeshPhysicalMaterialParameters;
    transform?: TextureTransform | null;
  }) {
    this.material = new MeshPhysicalMaterial(materialParameters);
    this.#transform = transform;
  }

  setTexture(texture: Texture | null): void {
    this.#ownedCopy?.dispose();
    this.#ownedCopy = null;
    this.#hasArtwork = texture !== null;
    this.material.map = texture ? this.#prepare(texture) : null;
    this.material.needsUpdate = true;
    this.#applyColor();
  }

  setFallbackColor(hex: string): void {
    this.#fallbackColor = hex;
    this.#applyColor();
  }

  dispose(): void {
    this.#ownedCopy?.dispose();
    this.material.dispose();
  }

  #prepare(texture: Texture): Texture {
    const transform = this.#transform;
    if (!transform) return texture;

    const copy = texture.clone();
    copy.center.set(0.5, 0.5);
    copy.repeat.set(transform.repeatX, transform.repeatY);
    copy.offset.set(transform.offsetX, transform.offsetY);
    this.#ownedCopy = copy;
    return copy;
  }

  #applyColor(): void {
    this.material.color.set(this.#hasArtwork ? WHITE : this.#fallbackColor);
  }
}
