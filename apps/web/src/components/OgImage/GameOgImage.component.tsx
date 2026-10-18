import {
  NOT_FOUND_GAME_NAME,
  OG_COLORS,
  OG_FRAME_STYLE,
  OG_IMAGE_SIZE,
  OG_PADDING,
} from './OgImage.constants';
import type { GameOgImageProps } from './OgImage.types';

/**
 * A game's social image: its cover beside its name. Inline styles, as the renderer needs. The
 * cover is BGG's original, since the renderer cannot read the processed WebP.
 */
export function GameOgImage({ game, collectionOf }: GameOgImageProps) {
  const imageUrl = game === null ? null : game.images.originalUrl;

  return (
    <div style={{ ...OG_FRAME_STYLE, alignItems: 'center', gap: 56 }}>
      {imageUrl !== null && (
        <img
          src={imageUrl}
          alt=""
          width={440}
          height={OG_IMAGE_SIZE.height - 2 * OG_PADDING}
          style={{ objectFit: 'contain' }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
        {collectionOf !== null && (
          <div style={{ display: 'flex', fontSize: 30, color: OG_COLORS.muted }}>
            In {collectionOf}&rsquo;s collection
          </div>
        )}
        <div style={{ display: 'flex', fontSize: 72, lineHeight: 1.1 }}>
          {game === null ? NOT_FOUND_GAME_NAME : game.name}
        </div>
        {game !== null && game.year !== null && (
          <div style={{ display: 'flex', fontSize: 36, color: OG_COLORS.muted }}>{game.year}</div>
        )}
      </div>
    </div>
  );
}
