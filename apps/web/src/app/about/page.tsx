import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/LegalPage';
import { externalLinks, LEGAL_EMAIL } from '@/lib/external-links';
import { routes } from '@/lib/route-params';

export const metadata: Metadata = {
  title: 'About',
  description: 'What Meeplewall is, where its data comes from, and who it is not affiliated with.',
};

export default function AboutPage() {
  return (
    <LegalPage title="About Meeplewall">
      <p>
        Meeplewall shows a BoardGameGeek user&apos;s board game collection as a shelf of 3D boxes.
        It is a free, non-commercial fan project: no ads, no accounts, no payments.
      </p>

      <h2>Where the data comes from</h2>
      <p>
        Collections, game details, ratings and cover images come from{' '}
        <a href={externalLinks.bggHome} rel="noreferrer">
          BoardGameGeek
        </a>{' '}
        and are used under its{' '}
        <a href={externalLinks.bggXmlApiTerms} rel="noreferrer">
          XML API Terms of Use
        </a>
        . Every game page links back to the game on BoardGameGeek. Meeplewall only reads public
        collections, never asks for a BoardGameGeek password, and refreshes a collection
        automatically when someone views it after it is a day old, or when a visitor asks for a
        refresh (at most once a minute per collection).
      </p>

      <h2>Not affiliated with BoardGameGeek</h2>
      <p>
        Meeplewall is an independent project. It is not affiliated with, sponsored by or endorsed by
        BoardGameGeek, LLC. &quot;BoardGameGeek&quot;, &quot;BGG&quot; and the Powered by BGG logo
        are trademarks of BoardGameGeek, LLC, used here only to credit the source of the data.
      </p>

      <h2>Game names and artwork</h2>
      <p>
        Game names, box art and descriptions belong to their publishers and designers. They appear
        here only to identify each game in a collection. Meeplewall claims no ownership of them.
      </p>

      <h2>Removal requests and contact</h2>
      <p>
        If you own a game, artwork or a BoardGameGeek collection shown here and want it removed, or
        have any other question, email <a href={externalLinks.legalEmail}>{LEGAL_EMAIL}</a>. How
        Meeplewall handles data is described in the{' '}
        <Link href={routes.privacy()}>privacy policy</Link>.
      </p>

      <h2>Source code</h2>
      <p>
        The source code is on{' '}
        <a href={externalLinks.sourceCode} rel="noreferrer">
          GitHub
        </a>{' '}
        under the MIT license. That license covers the code only, not the game data or artwork.
      </p>
    </LegalPage>
  );
}
