import { GameBoxViewer } from '@/components/GameBoxViewer';

import { bggGameUrl, gameFacts, gameTags } from './GameDetail.data';
import styles from './GameDetail.module.css';
import type { GameDetailProps } from './GameDetail.types';

/** One game: its 3D box beside its facts, tags and description. */
export function GameDetail({ game }: GameDetailProps) {
  const facts = gameFacts(game);
  const tags = gameTags(game);

  return (
    <article className={styles.layout}>
      <GameBoxViewer game={game.box} label={`${game.name} box in 3D`} />
      <div className={styles.details}>
        <h1 className={styles.title}>
          {game.name}
          {game.year !== null && <span className={styles.year}> ({game.year})</span>}
        </h1>
        {facts.length > 0 && (
          <dl className={styles.facts}>
            {facts.map((fact) => (
              <div key={fact.label} className={styles.fact}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {tags.length > 0 && (
          <ul className={styles.tags}>
            {tags.map((tag) => (
              <li key={tag} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
        )}
        {game.description !== null && <p className={styles.description}>{game.description}</p>}
        <a className={styles.source} href={bggGameUrl(game.bggId)} rel="noreferrer">
          View on BoardGameGeek
        </a>
      </div>
    </article>
  );
}
