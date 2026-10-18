import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type IUniform,
  Vector3,
  Vector4,
} from 'three';
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
import type { BoxFace, GameBoxInput, GameBoxLoadResult } from './types.js';

export const BOX_FACES: readonly BoxFace[] = ['front', 'back', 'spine', 'top', 'bottom'];

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
  url: string | undefined;
  /** Loaded artwork for `url`, or null while loading, after a failure, or with no URL. */
  texture: Texture<HTMLImageElement> | null;
  fallback: DataTexture;
  map: IUniform<Texture>;
  fit: IUniform<Vector4>;
}

/**
 * The single coated-card material shared by all six faces, plus the face
 * artwork it samples. One material keeps the lighting identical on every face.
 */
export class BoxMaterial {
  readonly material: MeshPhysicalMaterial;

  readonly #grain: DataTexture;
  readonly #halfExtents: IUniform<Vector3> = { value: new Vector3(0.5, 0.5, 0.5) };
  readonly #slots: Record<BoxFace, FaceSlot>;
  readonly #loader = new TextureLoader();
  readonly #anisotropy: number;
  readonly #onFrontAspect: (aspect: number) => void;
  readonly #onLoad: ((result: GameBoxLoadResult) => void) | undefined;
  readonly #pendingFaces = new Set<BoxFace>();
  readonly #failedFaces = new Set<BoxFace>();
  #box: OrientedBox | null = null;
  #disposed = false;

  constructor({
    anisotropy,
    onFrontAspect,
    onLoad,
  }: {
    anisotropy: number;
    /** Called with the front image's width over height each time a new front loads. */
    onFrontAspect: (aspect: number) => void;
    onLoad: ((result: GameBoxLoadResult) => void) | undefined;
  }) {
    this.#anisotropy = anisotropy;
    this.#onFrontAspect = onFrontAspect;
    this.#onLoad = onLoad;
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
      roughness: 0.6,
      metalness: 0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.34,
      envMapIntensity: 1,
      bumpMap: this.#grain,
      bumpScale: 0.9,
    });
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

  /** Applies a game's colours and starts loading any face URL that changed. */
  setGame(game: GameBoxInput): void {
    const wasLoading = this.#pendingFaces.size > 0;

    for (const face of BOX_FACES) {
      const slot = this.#slots[face];
      BoxMaterial.#paintFallback({ texture: slot.fallback, hex: game[FALLBACK_COLOR_KEY[face]] });

      const url = game.covers[face];
      if (url === slot.url) continue;

      slot.texture?.dispose();
      slot.texture = null;
      slot.url = url;
      // The previous URL's load state no longer applies, whether or not a new load starts.
      this.#pendingFaces.delete(face);
      this.#failedFaces.delete(face);
      this.#show(face);
      if (url !== undefined) this.#load({ face, url });
    }

    // Dropping the last face still in flight settles the batch without a load callback.
    if (wasLoading) this.#reportIfSettled();
  }

  dispose(): void {
    this.#disposed = true;
    for (const face of BOX_FACES) {
      const slot = this.#slots[face];
      slot.texture?.dispose();
      slot.fallback.dispose();
    }
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

  #load({ face, url }: { face: BoxFace; url: string }): void {
    this.#pendingFaces.add(face);

    this.#loader.load(
      url,
      (texture) => {
        const slot = this.#slots[face];
        if (this.#disposed || slot.url !== url) {
          texture.dispose();
          return;
        }

        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = this.#anisotropy;
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        slot.texture = texture;
        this.#show(face);
        if (face === 'front') this.#onFrontAspect(BoxMaterial.#imageAspect(texture));
        this.#settle({ face, url, failed: false });
      },
      undefined,
      () => this.#settle({ face, url, failed: true }),
    );
  }

  /** Records a finished load and reports once nothing is still in flight. */
  #settle({ face, url, failed }: { face: BoxFace; url: string; failed: boolean }): void {
    if (this.#disposed || this.#slots[face].url !== url) return;

    this.#pendingFaces.delete(face);
    if (failed) this.#failedFaces.add(face);
    this.#reportIfSettled();
  }

  #reportIfSettled(): void {
    if (this.#pendingFaces.size > 0) return;

    this.#onLoad?.({ failedFaces: BOX_FACES.filter((each) => this.#failedFaces.has(each)) });
  }

  #show(face: BoxFace): void {
    const slot = this.#slots[face];
    slot.map.value = slot.texture ?? slot.fallback;
    this.#refit(face);
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
      imageAspect: BoxMaterial.#imageAspect(texture),
      targetAspect: faceAspect({ box: this.#box, face }),
    });
  }

  static #imageAspect(texture: Texture<HTMLImageElement>): number {
    const { naturalWidth, naturalHeight } = texture.image;
    return naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  }

  static #createSlot(): FaceSlot {
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
    fallback.colorSpace = SRGBColorSpace;
    fallback.needsUpdate = true;
    return {
      url: undefined,
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
