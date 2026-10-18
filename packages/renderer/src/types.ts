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

/** Artwork the renderer loads: the box faces plus a hang tab's strip. */
export type PackageArtwork = BoxFace | 'hangTab';

/** A punched hang hole: a rounded slot with a circle on its upper edge. Edges are fractions of the tab artwork, measured from its top left. */
export interface HangHole {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Circle radius as a fraction of the tab height. */
  circleRadius: number;
  /** Slot corner rounding as a fraction of its shorter half side. Defaults to 1, a stadium. */
  slotRounding?: number;
}

/** A retail hang tab standing on top of the box. */
export interface HangTab {
  /** Tab artwork, spanning the full box width. */
  url: string;
  /** Tab height as a fraction of the box height. */
  heightFraction: number;
  /** Tab width as a fraction of the box width, cropping the artwork's side margins. Defaults to 1. */
  widthFraction?: number;
  /** Rounding of the two free corners, as a fraction of the tab's shorter side. Defaults to 0.28. */
  cornerRadius?: number;
  hole?: HangHole;
}

/** The lid's circle within a cover photo, as fractions of the image: centre and radius. */
export interface LidCrop {
  centerX: number;
  centerY: number;
  radius: number;
}

/** A pouch silhouette, as points in fractions of the cutout image measured from its top left. */
export interface PouchOutline {
  /** Width over height of the silhouette. */
  aspect: number;
  points: ReadonlyArray<readonly [number, number]>;
}

/** A rectangular cardboard box, optionally with a hang tab. */
export interface BoxShape {
  kind: 'box';
  hangTab?: HangTab;
}

/** A metal tin with a flat front and rounded corners. */
export interface RectTinShape {
  kind: 'rect-tin';
  /** Corner radius as a fraction of the shorter front edge. Defaults to 0.07. */
  cornerRadius?: number;
}

/** A short round tin with the artwork on its lid. Dimensions are millimetres. */
export interface RoundTinShape {
  kind: 'round-tin';
  diameter: number;
  height: number;
  /** Flat top-down lid art. When omitted the front cover is used, cropped by `lidCrop`. */
  label?: string;
  lidCrop?: LidCrop;
}

/** A cardboard tube with the artwork wrapped around it. Dimensions are millimetres. */
export interface TubeShape {
  kind: 'tube';
  diameter: number;
  height: number;
  /** Flat wrap art. Defaults to the front cover. */
  label?: string;
}

/** A crimped foil snack bag with the front cover printed on it. */
export interface FoilBagShape {
  kind: 'foil-bag';
}

/** A closed, puffed fabric pouch cut to a silhouette. */
export interface PouchShape {
  kind: 'pouch';
  /** The silhouette artwork, opaque out to the outline. */
  cutout: string;
  outline: PouchOutline;
}

/** The game's real packaging. */
export type PackageShape =
  BoxShape | RectTinShape | RoundTinShape | TubeShape | FoilBagShape | PouchShape;

/** Everything the renderer needs to draw one game's box. */
export interface GameBoxInput {
  /** Defaults to a plain box. */
  shape?: PackageShape;
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

/** Reported once every requested texture has loaded or failed. */
export interface GameBoxLoadResult {
  failedArtwork: PackageArtwork[];
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
