import { ScrollViewStyleReset } from 'expo-router/html';

// Canonical site origin. The web app is exported as a single-page bundle
// (app.json web.output = "single"), so this one HTML shell is what every URL —
// including invite links like `/?ref=MINDS-XXXX` — serves. Link-unfurl crawlers
// (Signal, iMessage, Twitter/X, Slack) fetch that HTML and read the Open Graph
// + Twitter Card tags below, so the invite link previews with a clean Minds card.
const SITE_ORIGIN = 'https://minds.on.recursiv.io';
const OG_IMAGE = `${SITE_ORIGIN}/og-invite.png`; // 1200x630, served from /public
const OG_TITLE = 'Join me on Minds';
const OG_DESCRIPTION = 'A social network you own. Think freely — and earn for what you share.';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Minds — Think Freely</title>
        <meta name="description" content={OG_DESCRIPTION} />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph — Signal, iMessage, Slack, Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Minds" />
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={OG_DESCRIPTION} />
        <meta property="og:url" content={SITE_ORIGIN} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Minds — you're invited" />

        {/* Twitter / X Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={OG_TITLE} />
        <meta name="twitter:description" content={OG_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        <meta name="theme-color" content="#08080a" />
        <ScrollViewStyleReset />
      </head>
      {/* NOTE: web.output is "single", so Expo Router does NOT render this file
          for the served HTML — the instant boot shell is injected into the built
          dist/index.html by scripts/inject-boot-shell.mjs (run from the build
          script), and removed on first paint by app/_layout.tsx (#minds-boot). */}
      <body>{children}</body>
    </html>
  );
}
