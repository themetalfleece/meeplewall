import { CylinderGeometry, Mesh, MeshPhysicalMaterial } from 'three';
import { ArtSurface } from './ArtSurface.js';
import type { PackageLayout } from './packageLayout.js';
import type { ArtworkChange, PackageColors, PackageModel } from './PackageModel.js';
import { patchSeamShader } from './seamShader.js';

const RADIAL_SEGMENTS = 64;
/** A tube's cap seam near the top and its base seam. */
const TUBE_SEAMS = [0.86, 0.06];
/** A round tin's lift-off lid. */
const TIN_SEAMS = [0.6];

export type CylinderLayout = Extract<PackageLayout, { kind: 'round-tin' | 'tube' }>;

interface CylinderParts {
  art: ArtSurface;
  /** Unprinted metal, painted the side colour. */
  band: MeshPhysicalMaterial | null;
  ends: MeshPhysicalMaterial[];
  /** In geometry group order: side, top cap, bottom cap. */
  materials: MeshPhysicalMaterial[];
}

/**
 * A round tin or a cardboard tube. A tube wraps its art around the side; a tin
 * prints it on the lid, which is turned to face the camera.
 */
export class CylinderModel implements PackageModel {
  readonly object: Mesh<CylinderGeometry, MeshPhysicalMaterial[]>;
  readonly #parts: CylinderParts;

  constructor({ layout }: { layout: CylinderLayout }) {
    this.#parts = CylinderModel.#createParts(layout);
    const geometry = new CylinderGeometry(
      layout.radius,
      layout.radius,
      layout.height,
      RADIAL_SEGMENTS,
      1,
      false,
    );
    this.object = new Mesh(geometry, this.#parts.materials);
    this.object.castShadow = true;
    // The tube turns the middle of its wrap, at -z, to the front. The tin lies
    // on its back so the lid faces the camera.
    if (layout.kind === 'tube') this.object.rotation.set(0, Math.PI, 0);
    else this.object.rotation.set(Math.PI / 2, 0, 0);
  }

  showArtwork({ artwork, texture }: ArtworkChange): void {
    if (artwork === 'front') this.#parts.art.setTexture(texture);
  }

  paint({ sideColor, edgeColor }: PackageColors): void {
    this.#parts.art.setFallbackColor(sideColor);
    this.#parts.band?.color.set(sideColor);
    for (const end of this.#parts.ends) end.color.set(edgeColor);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.#parts.art.dispose();
    this.#parts.band?.dispose();
    for (const end of this.#parts.ends) end.dispose();
  }

  static #createParts(layout: CylinderLayout): CylinderParts {
    const halfHeight = layout.height / 2;
    if (layout.kind === 'tube') {
      const art = new ArtSurface({
        material: new MeshPhysicalMaterial({
          roughness: 0.62,
          clearcoat: 0.22,
          clearcoatRoughness: 0.4,
        }),
      });
      CylinderModel.#addSeams({ material: art.material, halfHeight, seams: TUBE_SEAMS });
      const ends = [CylinderModel.#cardEnd(), CylinderModel.#cardEnd()];
      return { art, band: null, ends, materials: [art.material, ...ends] };
    }
    if (layout.kind === 'round-tin') {
      const art = new ArtSurface({
        material: new MeshPhysicalMaterial({
          metalness: 0.12,
          roughness: 0.42,
          clearcoat: 0.5,
          clearcoatRoughness: 0.28,
          envMapIntensity: 1.1,
        }),
        transform: layout.lid,
      });
      const band = new MeshPhysicalMaterial({ metalness: 0.85, roughness: 0.3, clearcoat: 0.2 });
      CylinderModel.#addSeams({ material: band, halfHeight, seams: TIN_SEAMS });
      const base = new MeshPhysicalMaterial({ metalness: 0.85, roughness: 0.35 });
      return { art, band, ends: [base], materials: [band, art.material, base] };
    }

    const unreachable: never = layout;
    throw new Error(`Unhandled cylinder layout: ${String(unreachable)}`);
  }

  static #cardEnd(): MeshPhysicalMaterial {
    return new MeshPhysicalMaterial({ metalness: 0, roughness: 0.72 });
  }

  static #addSeams({
    material,
    halfHeight,
    seams,
  }: {
    material: MeshPhysicalMaterial;
    halfHeight: number;
    seams: readonly number[];
  }): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uHalfHeight = { value: halfHeight };
      patchSeamShader({ shader, seams });
    };
    // Seam positions are baked into the GLSL, so each layout needs its own program.
    material.customProgramCacheKey = () => `meeplewall-seams:${seams.join(',')}`;
  }
}
