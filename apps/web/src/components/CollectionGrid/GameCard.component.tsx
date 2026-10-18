import Link from 'next/link';

import { routes } from '@/lib/route-params';

import styles from './CollectionGrid.module.css';
import type { GameCardProps } from './CollectionGrid.types';

export function GameCard({ username, shelf, card }: GameCardProps) {
  return (
    <li>
      <Link
        className={styles.card}
        href={routes.collectionGame({ username, shelf, bggId: card.bggId, name: card.name })}
      >
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
          {card.badges.map((badge) => (
            <span key={badge.kind} className={styles[badge.kind]}>
              {badge.label}
            </span>
          ))}
        </span>
      </Link>
    </li>
  );
}
