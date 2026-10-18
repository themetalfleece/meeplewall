import type { Object3D, Texture } from 'three';
import type { GameBoxInput, PackageArtwork } from './types.js';

/** A texture arriving for one artwork key, or null when it is cleared. */
export interface ArtworkChange {
  artwork: PackageArtwork;
  texture: Texture<HTMLImageElement> | null;
}

export type PackageColors = Pick<GameBoxInput, 'sideColor' | 'edgeColor'>;

/** One package's meshes. The scene owns the textures it is shown, not the model. */
export interface PackageModel {
  /** Centred on the origin, front towards +z. */
  readonly object: Object3D;
  showArtwork(change: ArtworkChange): void;
  paint(colors: PackageColors): void;
  /** Frees the model's own geometry and materials. */
  dispose(): void;
}
