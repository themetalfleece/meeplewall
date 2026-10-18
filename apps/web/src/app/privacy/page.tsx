import type { Metadata } from 'next';

import { LegalPage } from '@/components/LegalPage';
import { externalLinks, LEGAL_EMAIL } from '@/lib/external-links';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Meeplewall stores, why, and how to have it removed.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        Meeplewall has no accounts, sets no cookies, and runs no analytics, advertising or tracking
        scripts.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>
          A BoardGameGeek username, once someone looks it up here, with when its collection was
          first and last fetched.
        </li>
        <li>
          That user&apos;s public collection as BoardGameGeek shows it: the games they own or want
          to play, and their rating for each.
        </li>
        <li>
          Public details and cover images of those games, fetched from BoardGameGeek and resized for
          display.
        </li>
      </ul>
      <p>
        All of it is already public on BoardGameGeek. It is kept so collection pages load quickly
        and BoardGameGeek is not asked for the same data on every visit. A collection is fetched
        again when someone views it after it is a day old, or when a visitor asks for a refresh.
      </p>

      <h2>Server logs</h2>
      <p>
        Like any website, the server and its hosting provider keep short-lived technical logs of
        requests, such as the page asked for and when, to keep the site running and fix errors.
      </p>

      <h2>Sharing</h2>
      <p>
        Nothing is sold or shared with third parties. Data is fetched from BoardGameGeek, whose own{' '}
        <a href={externalLinks.bggPrivacy} rel="noreferrer">
          privacy policy
        </a>{' '}
        covers what you publish there.
      </p>

      <h2>Removing your data</h2>
      <p>
        To have a collection removed from Meeplewall, email{' '}
        <a href={externalLinks.legalEmail}>{LEGAL_EMAIL}</a> with the BoardGameGeek username.
      </p>
    </LegalPage>
  );
}
