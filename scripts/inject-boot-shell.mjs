#!/usr/bin/env node
/**
 * Inject an instant boot shell into the exported web index.html.
 *
 * Why a post-export step: the app is exported with `web.output: "single"`, and
 * in single-page mode Expo Router does NOT use app/+html.tsx — it emits a stock
 * template. So the shell can't be added in React; we inject it into the built
 * dist/index.html here.
 *
 * The shell paints from the served HTML at TTFB (~70ms) so users see a branded
 * Minds screen immediately instead of a blank page while the ~1MB JS bundle
 * downloads + parses (measured FCP ~9s). The root layout removes it on first
 * paint (app/_layout.tsx → #minds-boot); a 20s failsafe below guarantees it can
 * never strand the app.
 *
 * Idempotent: re-running is a no-op if the shell is already present.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.env.EXPO_WEB_DIST || 'dist';
const file = join(dist, 'index.html');

if (!existsSync(file)) {
  console.error(`[boot-shell] ${file} not found — did 'expo export --platform web' run?`);
  process.exit(1);
}

// Ship the Minds bulb as an SVG favicon so the browser tab matches the in-app
// collapsed logo (both the bulb), like legacy Minds. Copied to a stable path at
// the web root (Expo's asset pipeline content-hashes assets, so we can't link
// those from static HTML). The <link> is injected below.
const bulbSrc = join('assets', 'bulb.svg');
if (existsSync(bulbSrc)) {
  copyFileSync(bulbSrc, join(dist, 'bulb.svg'));
  console.log(`[boot-shell] copied ${bulbSrc} -> ${join(dist, 'bulb.svg')}`);
} else {
  console.warn(`[boot-shell] ${bulbSrc} not found — favicon link will 404`);
}

// Emit a serve.json so `serve dist` sends correct cache headers. The exported
// JS/CSS/font assets are content-hashed (index-<hash>.js), so they are safe to
// cache forever — this removes the ~1MB revalidation round-trip returning users
// were paying on every visit (the bundle shipped with an etag but no
// Cache-Control). index.html stays no-cache so a new deploy's asset hashes are
// always picked up. Written unconditionally (before the shell idempotency
// guard) so it lands even on a re-run.
const serveConfig = {
  headers: [
    {
      source: '_expo/static/**',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '**/*.@(js|css|woff|woff2|ttf|otf|png|jpg|jpeg|gif|svg|ico)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: 'index.html',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
  ],
};
writeFileSync(join(dist, 'serve.json'), JSON.stringify(serveConfig, null, 2));
console.log(`[boot-shell] wrote ${join(dist, 'serve.json')} (immutable cache for hashed assets)`);

let html = readFileSync(file, 'utf8');
if (html.includes('id="minds-boot"')) {
  console.log('[boot-shell] already injected — skipping shell');
  process.exit(0);
}

const STYLE = `<style id="minds-boot-style">
#minds-boot{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#08080a;transition:opacity .35s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
#minds-boot .mb-wm{color:#f2f2f4;font-size:30px;font-weight:600;letter-spacing:-.5px;margin-bottom:22px;opacity:.96}
#minds-boot .mb-sp{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:#f2c94c;animation:mb-spin .8s linear infinite}
@keyframes mb-spin{to{transform:rotate(360deg)}}
@media (prefers-color-scheme:light){#minds-boot{background:#fff}#minds-boot .mb-wm{color:#08080a}#minds-boot .mb-sp{border-color:rgba(0,0,0,.1);border-top-color:#c9962a}}
</style>`;

const SHELL = `<div id="minds-boot" aria-hidden="true"><div class="mb-wm">Minds</div><div class="mb-sp"></div></div>`;

const FAILSAFE = `<script>setTimeout(function(){var b=document.getElementById('minds-boot');if(b){b.style.opacity='0';setTimeout(function(){b.parentNode&&b.parentNode.removeChild(b)},400)}},20000)</script>`;

// SVG favicon (the bulb) so the browser tab matches the in-app logo. Modern
// browsers prefer the SVG icon over Expo's generated PNG favicon link.
const FAVICON = `<link rel="icon" type="image/svg+xml" href="/bulb.svg">`;

// Inject: style before </head>, shell right after <body>, failsafe before </body>.
if (!html.includes('</head>') || !html.includes('<body>') || !html.includes('</body>')) {
  console.error('[boot-shell] unexpected index.html shape (missing head/body markers)');
  process.exit(1);
}
html = html.replace('</head>', `${FAVICON}${STYLE}</head>`);
html = html.replace('<body>', `<body>${SHELL}`);
html = html.replace('</body>', `${FAILSAFE}</body>`);

writeFileSync(file, html);
console.log(`[boot-shell] injected into ${file}`);
