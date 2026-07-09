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

        {/* Instant boot shell: painted from the static HTML at TTFB (~70ms) so
            users see branded Minds immediately instead of a blank page while the
            JS bundle loads. Removed on first paint by app/_layout.tsx
            (#minds-boot); a 20s failsafe below guarantees it can't strand the
            app. Works because web.output is "static" (Expo renders this file). */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
#minds-boot{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#08080a;transition:opacity .35s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
#minds-boot .mb-wm{color:#f2f2f4;font-size:30px;font-weight:600;letter-spacing:-.5px;margin-bottom:22px;opacity:.96}
#minds-boot .mb-sp{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:#f2c94c;animation:mb-spin .8s linear infinite}
@keyframes mb-spin{to{transform:rotate(360deg)}}
@media (prefers-color-scheme:light){#minds-boot{background:#fff}#minds-boot .mb-wm{color:#08080a}#minds-boot .mb-sp{border-color:rgba(0,0,0,.1);border-top-color:#c9962a}}
`,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>
        <div id="minds-boot" aria-hidden="true">
          <div className="mb-wm">Minds</div>
          <div className="mb-sp" />
        </div>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){var b=document.getElementById('minds-boot');if(b){b.style.opacity='0';setTimeout(function(){b.parentNode&&b.parentNode.removeChild(b)},400)}},20000)`,
          }}
        />
      </body>
    </html>
  );
}
