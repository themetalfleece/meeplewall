import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { InstallPrompt } from '@/components/InstallPrompt';
import { Providers } from '@/components/Providers';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { BRAND_BACKGROUND_COLOR } from '@/lib/brand';
import { siteUrl } from '@/lib/env';

import './globals.css';

interface RootLayoutProps {
  children: ReactNode;
}

export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    title: { default: 'Meeplewall', template: '%s | Meeplewall' },
    description: 'Board game collections from BoardGameGeek, shelved as 3D boxes.',
    openGraph: { siteName: 'Meeplewall', type: 'website' },
    appleWebApp: { capable: true, title: 'Meeplewall', statusBarStyle: 'black' },
  };
}

export const viewport: Viewport = {
  themeColor: BRAND_BACKGROUND_COLOR,
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
          <InstallPrompt />
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
