import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { InstallPrompt } from '@/components/InstallPrompt';
import { Providers } from '@/components/Providers';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { BRAND_BACKGROUND_COLOR, SITE_DESCRIPTION, SITE_NAME } from '@/lib/brand';
import { siteUrl } from '@/lib/env';

import './globals.css';

interface RootLayoutProps {
  children: ReactNode;
}

export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    openGraph: { siteName: SITE_NAME, type: 'website' },
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'black' },
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
