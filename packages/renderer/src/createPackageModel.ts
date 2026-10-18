import { BagModel } from './BagModel.js';
import { BoxModel } from './BoxModel.js';
import type { BoxMaterial } from './BoxMaterial.js';
import { CylinderModel } from './CylinderModel.js';
import type { PackageLayout } from './packageLayout.js';
import type { PackageModel } from './PackageModel.js';

/** Builds the meshes for a package layout. Box-like shapes print with the shared box material. */
export function createPackageModel({
  layout,
  boxMaterial,
}: {
  layout: PackageLayout;
  boxMaterial: BoxMaterial;
}): PackageModel {
  if (layout.kind === 'box' || layout.kind === 'rect-tin') {
    return new BoxModel({ layout, boxMaterial });
  }
  if (layout.kind === 'round-tin' || layout.kind === 'tube') return new CylinderModel({ layout });
  if (layout.kind === 'foil-bag' || layout.kind === 'pouch') return new BagModel({ layout });

  const unreachable: never = layout;
  throw new Error(`Unhandled package layout: ${String(unreachable)}`);
}
