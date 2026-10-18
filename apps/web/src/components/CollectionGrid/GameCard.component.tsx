import Link from 'next/link';

import { formatRating } from '@/lib/format';
import { routes } from '@/lib/route-params';

import styles from './CollectionGrid.module.css';
import type { GameCardProps } from './CollectionGrid.types';

export function GameCard({ username, card }: GameCardProps) {
  return (
    <li>
      <Link className={styles.card} href={routes.collectionGame({ username, bggId: card.bggId })}>
        {card.thumbUrl === null ? (
          <span className={styles.noImage} aria-hidden="true" />
        ) : (
          <img
            className={styles.image}
            src={card.thumbUrl}
            alt=""
            width={200}
            height={200}
            loading="lazy"
            decoding="async"
          />
        )}
        <span className={styles.name}>{card.name}</span>
        <span className={styles.meta}>
          {card.year !== null && <span>{card.year}</span>}
          {card.owned && <span className={styles.owned}>Owned</span>}
          {card.wantToPlay && <span className={styles.want}>Want to play</span>}
          {card.userRating !== null && <span>Rated {formatRating(card.userRating)}</span>}
        </span>
      </Link>
    </li>
  );
}
