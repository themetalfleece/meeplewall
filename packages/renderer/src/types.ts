/** A box's outer dimensions in millimetres, in any order. */
export interface BoxSize {
  width: number;
  height: number;
  depth: number;
}

/** The box faces that carry artwork. Both long edge faces share the spine. */
export type BoxFace = 'front' | 'back' | 'spine' | 'top' | 'bottom';

/** Artwork URL per face. Only the front is required; a missing face is painted a flat colour. */
export interface BoxCovers {
  front: string;
  back?: string;
  spine?: string;
  top?: string;
  bottom?: string;
}

/** Everything the renderer needs to draw one game's box. */
export interface GameBoxInput {
  size: BoxSize;
  covers: BoxCovers;
  /** Fill for the front, spine and top while their art loads or when it is missing. */
  sideColor: string;
  /** Fill for the back and bottom while their art loads or when it is missing. */
  edgeColor: string;
  /** Front cover width over height. When omitted it is read from the front image once it loads. */
  coverAspect?: number;
}

/** Fixed screenshot viewpoint, in world units. */
export interface CameraPosition {
  x: number;
  y: number;
  z: number;
}

/** Reported once every requested face texture has loaded or failed. */
export interface GameBoxLoadResult {
  failedFaces: BoxFace[];
}

/** Mount-time settings. Changing one means unmounting and mounting again. */
export interface GameBoxOptions {
  /** Trackball drag-to-rotate and scroll-to-zoom. Defaults to true. */
  interactive?: boolean;
  /** Slow spin until the first drag. Defaults to true unless the user prefers reduced motion. */
  autoRotate?: boolean;
  /** Starting rotation about the vertical axis, in radians. Defaults to -0.5. */
  yaw?: number;
  cameraPosition?: CameraPosition;
  /** Scene clear colour. Defaults to the gallery background. */
  background?: string;
  /** Upper bound on the device pixel ratio. Defaults to 2. */
  maxPixelRatio?: number;
  onLoad?: (result: GameBoxLoadResult) => void;
}

/** The handle `mountGameBox` returns. */
export interface GameBoxHandle {
  /** Redraw for a new or changed game without recreating the WebGL context. */
  update: (game: GameBoxInput) => void;
  /** Stop rendering, free every GPU resource and remove the canvas. */
  unmount: () => void;
}
