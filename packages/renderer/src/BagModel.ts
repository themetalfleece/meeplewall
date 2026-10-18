import { type BufferGeometry, DoubleSide, Group, Mesh, MeshPhysicalMaterial } from 'three';
import { ArtSurface } from './ArtSurface.js';
import { pillowGeometry, pouchGeometry } from './packageGeometry.js';
import type { PackageLayout } from './packageLayout.js';
import type { ArtworkChange, PackageColors, PackageModel } from './PackageModel.js';

export type BagLayout = Extract<PackageLayout, { kind: 'foil-bag' | 'pouch' }>;

/**
 * A soft package. A foil bag is two creased pillow halves, the art on the front
 * and plain foil behind. A pouch is one closed solid with the cutout on both caps.
 */
export class BagModel implements PackageModel {
  readonly object = new Group();
  readonly #geometry: BufferGeometry;
  readonly #art: ArtSurface;
  /** The foil bag's plain back. */
  readonly #back: MeshPhysicalMaterial | null;

  constructor({ layout }: { layout: BagLayout }) {
    if (layout.kind === 'foil-bag') {
      this.#geometry = pillowGeometry({ ...layout, creases: true });
      this.#art = new ArtSurface({
        material: new MeshPhysicalMaterial({
          roughness: 0.32,
          metalness: 0.25,
          clearcoat: 0.5,
          clearcoatRoughness: 0.35,
        }),
      });
      this.#back = new MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.4, clearcoat: 0.5 });
      // The same half, mirrored, closes the bag.
      const back = new Mesh(this.#geometry, this.#back);
      back.scale.z = -1;
      this.#addMesh(back);
    } else {
      this.#geometry = pouchGeometry(layout);
      this.#art = new ArtSurface({
        material: new MeshPhysicalMaterial({
          roughness: 0.95,
          sheen: 0.2,
          sheenRoughness: 0.9,
          side: DoubleSide,
        }),
      });
      this.#back = null;
    }
    this.#addMesh(new Mesh(this.#geometry, this.#art.material));
  }

  showArtwork({ artwork, texture }: ArtworkChange): void {
    if (artwork === 'front') this.#art.setTexture(texture);
  }

  paint({ sideColor, edgeColor }: PackageColors): void {
    this.#art.setFallbackColor(sideColor);
    this.#back?.color.set(edgeColor);
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#art.dispose();
    this.#back?.dispose();
  }

  #addMesh(mesh: Mesh): void {
    mesh.castShadow = true;
    this.object.add(mesh);
  }
}
