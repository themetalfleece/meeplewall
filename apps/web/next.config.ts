import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trace from the repo root so the standalone bundle includes the workspace packages.
  outputFileTracingRoot: REPO_ROOT,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The nextjs skill and apps/web/AGENTS.md already carry these rules.
  agentRules: false,
  // Next preloads the CSS of the root not-found page and of every prefetched route as <link> tags,
  // which the current page never applies, so Chrome logs "preloaded but not used" warnings.
  // Inlining the CSS as <style> tags removes those preloads; the smoke checks require a clean
  // console. The cost is that returning visitors cannot reuse a cached stylesheet.
  experimental: { inlineCss: true },
};

export default nextConfig;
