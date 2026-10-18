// Fetches one game live and prints what the client parsed, plus the box size it cross-checks.
// Usage: pnpm --filter @meeplewall/boardgamegeek dev-fetch <bggId>
import { z } from 'zod';

import { createBggClient, crossCheckBoxSize } from '../src/index.ts';

const environment = z.object({ BGG_USER_AGENT: z.string().min(1) }).safeParse(process.env);

if (!environment.success) {
  throw new Error(
    'BGG_USER_AGENT is not set. Copy packages/boardgamegeek/.env.example to .env.local beside it.',
  );
}

const bggIdArgument = z.coerce.number().int().positive().safeParse(process.argv[2]);

if (!bggIdArgument.success) {
  throw new Error('Usage: dev-fetch <bggId>');
}

const client = createBggClient({
  userAgent: environment.data.BGG_USER_AGENT,
  requestsPerSecond: 2,
});
const game = await client.fetchGame({ bggId: bggIdArgument.data });

if (game === null) {
  throw new Error(`BGG has no game with id ${bggIdArgument.data}`);
}

const versions = await client.fetchGameVersions({ bggId: bggIdArgument.data });

console.dir(
  {
    game: { ...game, description: `${game.description.slice(0, 120)}...` },
    versionCount: versions.length,
    box: crossCheckBoxSize({ versions, title: game.name }),
  },
  { depth: null },
);
