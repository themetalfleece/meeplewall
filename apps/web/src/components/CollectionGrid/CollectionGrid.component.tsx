import styles from './CollectionGrid.module.css';
import type { CollectionGridProps } from './CollectionGrid.types';
import { GameCard } from './GameCard.component';

/** One shelf of a user's games as a grid of covers, in the collection's stored order. */
export function CollectionGrid({ username, shelf, cards }: CollectionGridProps) {
  if (cards.length === 0) {
    return <p className={styles.empty}>No games on this shelf yet.</p>;
  }

  return (
    <ul className={styles.grid}>
      {cards.map((card) => (
        <GameCard key={card.bggId} username={username} shelf={shelf} card={card} />
      ))}
    </ul>
  );
}
