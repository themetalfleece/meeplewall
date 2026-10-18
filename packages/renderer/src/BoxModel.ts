import { type BufferGeometry, Group, Mesh, MeshPhysicalMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ArtSurface } from './ArtSurface.js';
import type { BoxMaterial } from './BoxMaterial.js';
import { bevelRadius } from './dimensions.js';
import { hangTabGeometry, tinGeometry } from './packageGeometry.js';
import type { HangTabLayout, PackageLayout } from './packageLayout.js';
import type { ArtworkChange, PackageColors, PackageModel } from './PackageModel.js';

const BEVEL_SEGMENTS = 6;

export type BoxLikeLayout = Extract<PackageLayout, { kind: 'box' | 'rect-tin' }>;

interface HangTabParts {
  mesh: Mesh;
  art: ArtSurface;
  band: MeshPhysicalMaterial;
}

/** A rounded cardboard box or a rectangular tin, printed by the shared box material. */
export class BoxModel implements PackageModel {
  readonly object = new Group();
  readonly #body: Mesh;
  readonly #boxMaterial: BoxMaterial;
  readonly #hangTab: HangTabParts | null;

  constructor({ layout, boxMaterial }: { layout: BoxLikeLayout; boxMaterial: BoxMaterial }) {
    this.#boxMaterial = boxMaterial;
    boxMaterial.setBox(layout.box);
    boxMaterial.setFinish(layout.kind === 'rect-tin' ? 'tin' : 'card');

    this.#body = new Mesh(BoxModel.#bodyGeometry(layout), boxMaterial.material);
    this.#body.castShadow = true;
    this.object.add(this.#body);

    const tab = layout.kind === 'box' ? layout.hangTab : null;
    this.#hangTab = tab ? BoxModel.#createHangTab(tab) : null;
    if (this.#hangTab) {
      this.#hangTab.mesh.position.y = layout.box.height / 2;
      this.object.add(this.#hangTab.mesh);
    }
  }

  showArtwork({ artwork, texture }: ArtworkChange): void {
    if (artwork === 'hangTab') {
      this.#hangTab?.art.setTexture(texture);
      return;
    }

    this.#boxMaterial.setFace({ face: artwork, texture });
  }

  paint(colors: PackageColors): void {
    this.#boxMaterial.setColors(colors);
    this.#hangTab?.art.setFallbackColor(colors.sideColor);
    this.#hangTab?.band.color.set(colors.sideColor);
  }

  /** The box material outlives a rebuild, so the scene frees it. */
  dispose(): void {
    this.#body.geometry.dispose();
    if (!this.#hangTab) return;

    this.#hangTab.mesh.geometry.dispose();
    this.#hangTab.art.dispose();
    this.#hangTab.band.dispose();
  }

  static #bodyGeometry(layout: BoxLikeLayout): BufferGeometry {
    const { box } = layout;
    if (layout.kind === 'box') {
      return new RoundedBoxGeometry(
        box.width,
        box.height,
        box.depth,
        BEVEL_SEGMENTS,
        bevelRadius(box),
      );
    }
    if (layout.kind === 'rect-tin') {
      return tinGeometry({ ...box, cornerRadius: layout.cornerRadius });
    }

    const unreachable: never = layout;
    throw new Error(`Unhandled box layout: ${String(unreachable)}`);
  }

  static #createHangTab(tab: HangTabLayout): HangTabParts {
    const art = new ArtSurface({
      material: new MeshPhysicalMaterial({
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.34,
      }),
    });
    const band = new MeshPhysicalMaterial({ roughness: 0.6 });
    // Extrusion groups: 0 is the front and back caps, 1 is the walls.
    const mesh = new Mesh(hangTabGeometry(tab), [art.material, band]);
    mesh.castShadow = true;
    return { mesh, art, band };
  }
}
