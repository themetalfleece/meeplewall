import { OG_COLORS, OG_IMAGE_SIZE } from './OgImage.constants';
import type { GameOgImageProps } from './OgImage.types';

const NOT_FOUND_NAME = 'Board game not found';

/**
 * A game's social image: its cover beside its name. Inline styles, as the renderer needs. The
 * cover is BGG's original, since the renderer cannot read the processed WebP.
 */
export function GameOgImage({ game, collectionOf }: GameOgImageProps) {
  const imageUrl = game === null ? null : game.images.originalUrl;

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        gap: 56,
        padding: 64,
        background: OG_COLORS.background,
        color: OG_COLORS.text,
        fontFamily: 'Georgia, serif',
      }}
    >
      {imageUrl !== null && (
        <img
          src={imageUrl}
          alt=""
          width={440}
          height={OG_IMAGE_SIZE.height - 128}
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
          {game === null ? NOT_FOUND_NAME : game.name}
        </div>
        {game !== null && game.year !== null && (
          <div style={{ display: 'flex', fontSize: 36, color: OG_COLORS.muted }}>{game.year}</div>
        )}
      </div>
    </div>
  );
}
