import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  type Texture,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ArtworkLoader, imageAspect } from './ArtworkLoader.js';
import { BoxMaterial } from './BoxMaterial.js';
import { createPackageModel } from './createPackageModel.js';
import {
  PACKAGE_ARTWORKS,
  artworkUrls,
  layoutPackage,
  packageHalfHeight,
  shapeOf,
} from './packageLayout.js';
import type { ArtworkChange, PackageModel } from './PackageModel.js';
import type { CameraPosition, GameBoxInput, GameBoxOptions, PackageArtwork } from './types.js';

const DEFAULT_BACKGROUND = '#0b0b0c';
export const DEFAULT_YAW = -0.5;
export const DEFAULT_CAMERA: CameraPosition = { x: 3, y: 2.1, z: 6.2 };
const DEFAULT_MAX_PIXEL_RATIO = 2;
const IDLE_SPIN_PER_FRAME = 0.0025;
const STUDIO_MAIN_LIGHT_INTENSITY = 5;
/** Used to orient the box until the front image reports its real aspect. */
const ASSUMED_COVER_ASPECT = 1;

/**
 * One game's package on its own canvas: studio lighting, a contact shadow, trackball
 * controls and an MSAA plus SMAA pipeline. Owns every GPU resource it creates.
 */
export class GameBoxScene {
  readonly #element: HTMLElement;
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(35, 1, 0.1, 100);
  readonly #environment: Texture;
  readonly #artwork: ArtworkLoader<PackageArtwork>;
  readonly #boxMaterial = new BoxMaterial();
  /** Carries the yaw and the idle spin, whichever package is inside. */
  readonly #turntable = new Group();
  readonly #ground: Mesh<PlaneGeometry, ShadowMaterial>;
  readonly #followLight = new DirectionalLight('#fff6ec', 1.15);
  readonly #controls: TrackballControls | null;
  readonly #composer: EffectComposer;
  readonly #smaaPass = new SMAAPass();
  readonly #resizeObserver: ResizeObserver;
  readonly #maxPixelRatio: number;
  readonly #cameraDirection = new Vector3();
  readonly #cameraRight = new Vector3();
  static readonly #UP = new Vector3(0, 1, 0);
  #game: GameBoxInput;
  #frontUrl: string | undefined;
  #frontAspect: number | null = null;
  #model: PackageModel | null = null;
  /** The layout `#model` was built from, serialised, so an unchanged one is not rebuilt. */
  #modelKey = '';
  #idle: boolean;

  constructor({
    element,
    game,
    options,
  }: {
    element: HTMLElement;
    game: GameBoxInput;
    options: GameBoxOptions;
  }) {
    this.#element = element;
    this.#game = game;
    this.#maxPixelRatio = options.maxPixelRatio ?? DEFAULT_MAX_PIXEL_RATIO;
    this.#idle = options.autoRotate ?? !GameBoxScene.#prefersReducedMotion();

    this.#renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = PCFShadowMap;
    this.#renderer.toneMapping = ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 1.05;
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.domElement.style.display = 'block';
    this.#renderer.domElement.style.width = '100%';
    this.#renderer.domElement.style.height = '100%';
    element.appendChild(this.#renderer.domElement);

    this.#scene.background = new Color(options.background ?? DEFAULT_BACKGROUND);
    const camera = options.cameraPosition ?? DEFAULT_CAMERA;
    this.#camera.position.set(camera.x, camera.y, camera.z);

    const pmrem = new PMREMGenerator(this.#renderer);
    const room = GameBoxScene.#createStudio();
    this.#environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.#scene.environment = this.#environment;
    this.#addLights();

    const { onLoad } = options;
    this.#artwork = new ArtworkLoader({
      artworks: PACKAGE_ARTWORKS,
      anisotropy: this.#renderer.capabilities.getMaxAnisotropy(),
      onTexture: (change) => this.#handleTexture(change),
      onSettled: (failedArtwork) => onLoad?.({ failedArtwork }),
    });
    this.#turntable.rotation.y = options.yaw ?? DEFAULT_YAW;
    this.#scene.add(this.#turntable);

    this.#ground = new Mesh(new PlaneGeometry(40, 40), new ShadowMaterial({ opacity: 0.42 }));
    this.#ground.rotation.x = -Math.PI / 2;
    this.#ground.receiveShadow = true;
    this.#scene.add(this.#ground);

    this.#controls = options.interactive === false ? null : this.#createControls();

    // MSAA on the half-float target smooths the silhouette. SMAA then cleans the
    // shader and texture seams on the bevels, which MSAA alone leaves jagged.
    // OutputPass applies tone mapping and the sRGB transfer at the end.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    this.#composer = new EffectComposer(this.#renderer, target);
    this.#composer.addPass(new RenderPass(this.#scene, this.#camera));
    this.#composer.addPass(this.#smaaPass);
    this.#composer.addPass(new OutputPass());

    this.update(game);

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(element);
    this.#resize();
    this.#renderer.setAnimationLoop(() => this.#renderFrame());
  }

  update(game: GameBoxInput): void {
    const urls = artworkUrls(game);
    if (urls.front !== this.#frontUrl) this.#frontAspect = null;

    this.#frontUrl = urls.front;
    this.#game = game;
    this.#rebuild();
    this.#model?.paint(game);
    this.#artwork.setUrls(urls);
  }

  dispose(): void {
    this.#renderer.setAnimationLoop(null);
    this.#resizeObserver.disconnect();
    this.#controls?.dispose();
    this.#model?.dispose();
    this.#boxMaterial.dispose();
    this.#artwork.dispose();
    this.#ground.geometry.dispose();
    this.#ground.material.dispose();
    this.#environment.dispose();
    this.#smaaPass.dispose();
    this.#composer.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  /** Rebuilds the package only when its layout actually changes. */
  #rebuild(): void {
    const layout = layoutPackage({
      shape: shapeOf(this.#game),
      size: this.#game.size,
      coverAspect: this.#coverAspect(),
    });
    const key = JSON.stringify(layout);
    if (key === this.#modelKey) return;

    if (this.#model) {
      this.#turntable.remove(this.#model.object);
      this.#model.dispose();
    }
    const model = createPackageModel({ layout, boxMaterial: this.#boxMaterial });
    this.#model = model;
    this.#modelKey = key;
    this.#turntable.add(model.object);
    this.#ground.position.y = -packageHalfHeight(layout);
    model.paint(this.#game);
    for (const artwork of PACKAGE_ARTWORKS) {
      model.showArtwork({ artwork, texture: this.#artwork.texture(artwork) });
    }
  }

  #coverAspect(): number {
    const declared = this.#game.coverAspect;
    if (declared !== undefined) return declared;

    const measured = this.#frontAspect;
    if (measured !== null) return measured;

    return ASSUMED_COVER_ASPECT;
  }

  #handleTexture(change: ArtworkChange): void {
    this.#model?.showArtwork(change);
    if (change.artwork !== 'front' || !change.texture) return;

    // The front image's real aspect can reorient the package, which rebuilds it.
    this.#frontAspect = imageAspect(change.texture);
    this.#rebuild();
  }

  #addLights(): void {
    this.#scene.add(new HemisphereLight('#cfd6e6', '#0a0a0b', 0.35));

    const key = new DirectionalLight('#fff6ec', 2.4);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 6;
    this.#scene.add(key);

    const rim = new DirectionalLight('#8fb4ff', 1);
    rim.position.set(-5, 3, -4);
    this.#scene.add(rim);

    // Under-fill, so the bottom face is legible when the box is turned over.
    const under = new DirectionalLight('#aeb6c6', 0.55);
    under.position.set(-1.5, -5, 2.5);
    this.#scene.add(under);

    // Follows the camera, so whichever face is in view keeps a specular sheen.
    this.#followLight.target.position.set(0, 0, 0);
    this.#scene.add(this.#followLight, this.#followLight.target);
  }

  // A trackball rather than orbit controls: orbit pins the up vector, so the box
  // could never be tumbled over to show its top and bottom.
  #createControls(): TrackballControls {
    const controls = new TrackballControls(this.#camera, this.#renderer.domElement);
    controls.rotateSpeed = 3;
    controls.zoomSpeed = 1.2;
    controls.noPan = true;
    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.12;
    controls.minDistance = 3.5;
    controls.maxDistance = 11;
    controls.target.set(0, 0, 0);
    controls.addEventListener('start', () => {
      this.#idle = false;
    });
    return controls;
  }

  #resize(): void {
    const width = this.#element.clientWidth;
    const height = this.#element.clientHeight;
    if (width === 0 || height === 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio, this.#maxPixelRatio);
    this.#renderer.setPixelRatio(pixelRatio);
    this.#renderer.setSize(width, height, false);
    this.#composer.setPixelRatio(pixelRatio);
    this.#composer.setSize(width, height);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#controls?.handleResize();
  }

  #renderFrame(): void {
    if (this.#idle) this.#turntable.rotation.y += IDLE_SPIN_PER_FRAME;
    this.#controls?.update();

    // Hide the shadow floor once the camera drops below it, or it hides the bottom face.
    const floor = this.#ground.position.y;
    this.#ground.visible = this.#camera.position.y > floor + 0.02;

    this.#placeFollowLight();
    this.#composer.render();
  }

  /** Parks the highlight up and to the side of the camera for a glancing specular lobe. */
  #placeFollowLight(): void {
    this.#camera.getWorldDirection(this.#cameraDirection);
    this.#cameraRight.crossVectors(this.#cameraDirection, GameBoxScene.#UP).normalize();
    this.#followLight.position
      .copy(this.#camera.position)
      .addScaledVector(this.#cameraRight, 2.5)
      .addScaledVector(GameBoxScene.#UP, 3);
  }

  /**
   * The reflection studio the look was tuned under. Newer three.js lights the
   * room far brighter and lowers it by 3.5 units, which washes out the cover, so
   * both are put back to the dimmer, centred room.
   */
  static #createStudio(): RoomEnvironment {
    const room = new RoomEnvironment();
    room.position.y = 0;
    room.traverse((child) => {
      if (child instanceof PointLight) child.intensity = STUDIO_MAIN_LIGHT_INTENSITY;
    });
    return room;
  }

  static #prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
