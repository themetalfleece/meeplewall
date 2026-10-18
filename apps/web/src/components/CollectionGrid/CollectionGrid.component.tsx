import styles from './CollectionGrid.module.css';
import type { CollectionGridProps } from './CollectionGrid.types';
import { GameCard } from './GameCard.component';

/** A user's games as a grid of covers, in the collection's stored order. */
export function CollectionGrid({ username, cards }: CollectionGridProps) {
  if (cards.length === 0) {
    return <p className={styles.empty}>No games in this collection yet.</p>;
  }

  return (
    <ul className={styles.grid}>
      {cards.map((card) => (
        <GameCard key={card.bggId} username={username} card={card} />
      ))}
    </ul>
  );
}
