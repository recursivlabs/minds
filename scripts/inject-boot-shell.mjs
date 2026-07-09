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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.env.EXPO_WEB_DIST || 'dist';
const file = join(dist, 'index.html');

if (!existsSync(file)) {
  console.error(`[boot-shell] ${file} not found — did 'expo export --platform web' run?`);
  process.exit(1);
}

let html = readFileSync(file, 'utf8');
if (html.includes('id="minds-boot"')) {
  console.log('[boot-shell] already injected — skipping');
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

// Inject: style before </head>, shell right after <body>, failsafe before </body>.
if (!html.includes('</head>') || !html.includes('<body>') || !html.includes('</body>')) {
  console.error('[boot-shell] unexpected index.html shape (missing head/body markers)');
  process.exit(1);
}
html = html.replace('</head>', `${STYLE}</head>`);
html = html.replace('<body>', `<body>${SHELL}`);
html = html.replace('</body>', `${FAILSAFE}</body>`);

writeFileSync(file, html);
console.log(`[boot-shell] injected into ${file}`);
