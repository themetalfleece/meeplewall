import { OG_COLORS } from './OgImage.constants';
import { collectionOgText } from './OgImage.data';
import type { CollectionOgImageProps } from './OgImage.types';

/** A collection's social image: the owner's name over a row of covers. */
export function CollectionOgImage({ summary, username }: CollectionOgImageProps) {
  const { title, subtitle } = collectionOgText({ summary, username });
  const coverUrls = summary === null ? [] : summary.coverUrls;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        justifyContent: 'space-between',
        padding: 64,
        background: OG_COLORS.background,
        color: OG_COLORS.text,
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', fontSize: 68 }}>{title}</div>
        {subtitle !== null && (
          <div style={{ display: 'flex', fontSize: 34, color: OG_COLORS.muted }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {coverUrls.map((url) => (
          <img
            key={url}
            src={url}
            alt=""
            width={190}
            height={240}
            style={{ objectFit: 'contain', background: OG_COLORS.surface, borderRadius: 8 }}
          />
        ))}
      </div>
    </div>
  );
}
