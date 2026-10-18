import type { Object3D } from 'three';
import type { TextureChange } from './ArtworkLoader.js';
import type { GameBoxInput, PackageArtwork } from './types.js';

export type ArtworkChange = TextureChange<PackageArtwork>;

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
