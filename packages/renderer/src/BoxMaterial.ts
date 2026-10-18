import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  type IUniform,
  Vector3,
  Vector4,
} from 'three';
import { imageAspect } from './ArtworkLoader.js';
import { patchBoxShader } from './boxShader.js';
import { parseHexColor } from './color.js';
import {
  IDENTITY_UV_TRANSFORM,
  coverFit,
  faceAspect,
  type OrientedBox,
  type UvTransform,
} from './dimensions.js';
import { PAPER_GRAIN_SIZE, generatePaperGrain } from './paperGrain.js';
import type { BoxFace, GameBoxInput } from './types.js';

export const BOX_FACES: readonly BoxFace[] = ['front', 'back', 'spine', 'top', 'bottom'];

/** The surface a box is printed on. */
export type BoxFinish = 'card' | 'tin';

interface FinishSettings {
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
  bumpScale: number;
}

// A tin is glossier and smoother than coated card, but stays non-metallic so the print survives.
const FINISHES: Record<BoxFinish, FinishSettings> = {
  card: {
    roughness: 0.6,
    clearcoat: 0.45,
    clearcoatRoughness: 0.34,
    envMapIntensity: 1,
    bumpScale: 0.9,
  },
  tin: {
    roughness: 0.34,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
    bumpScale: 0.4,
  },
};

/** Which flat colour stands in for each face until its art arrives. */
const FALLBACK_COLOR_KEY: Record<BoxFace, 'sideColor' | 'edgeColor'> = {
  front: 'sideColor',
  back: 'edgeColor',
  spine: 'sideColor',
  top: 'sideColor',
  bottom: 'edgeColor',
};

const UNIFORM_SUFFIX: Record<BoxFace, string> = {
  front: 'Front',
  back: 'Back',
  spine: 'Spine',
  top: 'Top',
  bottom: 'Bottom',
};

/** The grain is pure data, so it is generated once and shared by every mount. */
let paperGrainPixels: Uint8Array | null = null;

interface FaceSlot {
  /** Loaded artwork, or null while it loads, after a failure, or with no URL. */
  texture: Texture<HTMLImageElement> | null;
  fallback: DataTexture;
  map: IUniform<Texture>;
  fit: IUniform<Vector4>;
}

/**
 * The single coated-card material shared by all six faces. One material keeps
 * the lighting identical on every face. The textures it shows belong to the caller.
 */
export class BoxMaterial {
  readonly material: MeshPhysicalMaterial;

  readonly #grain: DataTexture;
  readonly #halfExtents: IUniform<Vector3> = { value: new Vector3(0.5, 0.5, 0.5) };
  readonly #slots: Record<BoxFace, FaceSlot>;
  #box: OrientedBox | null = null;

  constructor() {
    this.#grain = BoxMaterial.#createGrainTexture();
    this.#slots = {
      front: BoxMaterial.#createSlot(),
      back: BoxMaterial.#createSlot(),
      spine: BoxMaterial.#createSlot(),
      top: BoxMaterial.#createSlot(),
      bottom: BoxMaterial.#createSlot(),
    };

    this.material = new MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      bumpMap: this.#grain,
    });
    this.setFinish('card');
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.#uniforms());
      patchBoxShader(shader);
    };
    // Every box compiles to the same program, so they share one.
    this.material.customProgramCacheKey = () => 'meeplewall-box';
  }

  /** Points the face projection at new box extents and refits the artwork to them. */
  setBox(box: OrientedBox): void {
    this.#box = box;
    this.#halfExtents.value.set(box.width / 2, box.height / 2, box.depth / 2);
    for (const face of BOX_FACES) this.#refit(face);
  }

  /** Paints each face's stand-in colour, shown until its artwork arrives. */
  setColors(game: Pick<GameBoxInput, 'sideColor' | 'edgeColor'>): void {
    for (const face of BOX_FACES) {
      BoxMaterial.#paintFallback({
        texture: this.#slots[face].fallback,
        hex: game[FALLBACK_COLOR_KEY[face]],
      });
    }
  }

  /** Shows a face's artwork, or its stand-in colour when `texture` is null. */
  setFace({ face, texture }: { face: BoxFace; texture: Texture<HTMLImageElement> | null }): void {
    const slot = this.#slots[face];
    slot.texture = texture;
    slot.map.value = texture ?? slot.fallback;
    this.#refit(face);
  }

  setFinish(finish: BoxFinish): void {
    Object.assign(this.material, FINISHES[finish]);
  }

  dispose(): void {
    for (const face of BOX_FACES) this.#slots[face].fallback.dispose();
    this.#grain.dispose();
    this.material.dispose();
  }

  #uniforms(): Record<string, IUniform> {
    const uniforms: Record<string, IUniform> = { uHalf: this.#halfExtents };
    for (const face of BOX_FACES) {
      uniforms[`t${UNIFORM_SUFFIX[face]}`] = this.#slots[face].map;
      uniforms[`uFit${UNIFORM_SUFFIX[face]}`] = this.#slots[face].fit;
    }
    return uniforms;
  }

  #refit(face: BoxFace): void {
    const slot = this.#slots[face];
    const transform = this.#fitFor({ face, texture: slot.texture });
    slot.fit.value.set(transform.scaleX, transform.scaleY, transform.offsetX, transform.offsetY);
  }

  #fitFor({
    face,
    texture,
  }: {
    face: BoxFace;
    texture: Texture<HTMLImageElement> | null;
  }): UvTransform {
    if (!this.#box || !texture) return IDENTITY_UV_TRANSFORM;

    return coverFit({
      imageAspect: imageAspect(texture),
      targetAspect: faceAspect({ box: this.#box, face }),
    });
  }

  static #createSlot(): FaceSlot {
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
    fallback.colorSpace = SRGBColorSpace;
    fallback.needsUpdate = true;
    return {
      texture: null,
      fallback,
      map: { value: fallback },
      fit: { value: new Vector4(1, 1, 0, 0) },
    };
  }

  static #paintFallback({ texture, hex }: { texture: DataTexture; hex: string }): void {
    const [red, green, blue] = parseHexColor(hex);
    const { data } = texture.image;
    if (!data || (data[0] === red && data[1] === green && data[2] === blue)) return;

    data.set([red, green, blue, 255]);
    texture.needsUpdate = true;
  }

  static #createGrainTexture(): DataTexture {
    paperGrainPixels ??= generatePaperGrain(PAPER_GRAIN_SIZE);

    const texture = new DataTexture(
      paperGrainPixels,
      PAPER_GRAIN_SIZE,
      PAPER_GRAIN_SIZE,
      RGBAFormat,
    );
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(7, 7);
    // Trilinear mipmaps keep the fine grain from shimmering while the box turns.
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}
