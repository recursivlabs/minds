import { Platform } from 'react-native';

/**
 * Markdown link/bare-URL destinations are attacker-controlled post content that
 * ends up in `href` (web) and `Linking.openURL` (native). Only allow schemes
 * that can't execute script or smuggle credentials — everything else
 * (javascript:, data:, vbscript:, intent:, file:, ...) renders as plain text.
 */
const SAFE_URL_SCHEME = /^(https?:|mailto:)/i;

export function isSafeUrl(url: string): boolean {
  return SAFE_URL_SCHEME.test(url.trim());
}

// The global entity-escape pass below covers & < > but not quotes, so any
// value placed inside an HTML attribute must escape them too or the URL can
// break out of the href and inject handlers.
const escapeAttr = (value: string): string =>
  value.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Simple markdown-to-HTML converter for web.
 * Handles: **bold**, *italic*, `code`, [links](url), and line breaks.
 * No external dependencies.
 */
export function renderMarkdownToHtml(text: string): string {
  if (!text) return '';

  // Placeholder tokens protect already-linked content from later linkification.
  // Without this, bare-URL detection would re-match URLs that are already
  // inside a markdown `[text](url)` link or an HTML anchor we just emitted.
  const placeholders: string[] = [];
  const stash = (html: string) => {
    const idx = placeholders.length;
    placeholders.push(html);
    return `\u0000${idx}\u0000`;
  };

  // 1. Escape entities, then stash multi-line code blocks as single tokens so
  //    the line-by-line block pass below never splits them.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, (_m, code) => stash(`<pre style="background:#1a1a1e;padding:8px 12px;border-radius:6px;overflow-x:auto;font-family:monospace;font-size:13px;color:#a0a0a8;margin:8px 0"><code>${code}</code></pre>`));

  // 2. Inline formatting applied to a single line's content.
  const inline = (line: string): string => line
    .replace(/`([^`]+)`/g, (_m, code) => stash(`<code style="background:#1a1a1e;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;color:#a0a0a8">${code}</code>`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => (
      isSafeUrl(url)
        ? stash(`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" style="color:#d4a844;text-decoration:underline">${label}</a>`)
        : m
    ))
    .replace(/\bhttps?:\/\/[^\s<>()\[\]"']+/g, (m) => {
      let url = m;
      let trailing = '';
      const trailers = ['.', ',', ';', ':', '!', '?', ')', ']'];
      while (url.length > 0 && trailers.includes(url[url.length - 1])) {
        trailing = url[url.length - 1] + trailing;
        url = url.slice(0, -1);
      }
      return `${stash(`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" style="color:#d4a844;text-decoration:underline">${url}</a>`)}${trailing}`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|\s)#([a-zA-Z0-9_]+)/g, (_m, lead, tag) => `${lead}${stash(`<a href="/(tabs)/discover/posts?q=%23${tag}" style="color:#d4a844;text-decoration:none">#${tag}</a>`)}`)
    .replace(/(^|\s)@([a-zA-Z0-9_]+)/g, (_m, lead, name) => `${lead}${stash(`<a href="/(tabs)/user/${name}" style="color:#d4a844;text-decoration:none">@${name}</a>`)}`);

  // 3. Block pass: walk lines so bullet/numbered lists and headings render as
  //    real <ul>/<ol>/<h*> instead of leaking raw "-", "*", "#" markers.
  const lines = escaped.split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const openList = (t: 'ul' | 'ol') => {
    if (listType !== t) {
      closeList();
      out.push(t === 'ul' ? '<ul style="margin:6px 0;padding-left:22px">' : '<ol style="margin:6px 0;padding-left:22px">');
      listType = t;
    }
  };

  for (const line of lines) {
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    if (ul) {
      openList('ul');
      out.push(`<li style="margin:2px 0">${inline(ul[1])}</li>`);
    } else if (ol) {
      openList('ol');
      out.push(`<li style="margin:2px 0">${inline(ol[1])}</li>`);
    } else if (h3) {
      closeList(); out.push(`<h3 style="font-size:18px;font-weight:600;margin:12px 0 4px">${inline(h3[1])}</h3>`);
    } else if (h2) {
      closeList(); out.push(`<h2 style="font-size:22px;font-weight:600;margin:12px 0 4px">${inline(h2[1])}</h2>`);
    } else if (h1) {
      closeList(); out.push(`<h1 style="font-size:28px;font-weight:700;margin:12px 0 4px">${inline(h1[1])}</h1>`);
    } else if (line.trim() === '') {
      closeList(); out.push('<br />');
    } else {
      closeList(); out.push(`${inline(line)}<br />`);
    }
  }
  closeList();

  let html = out.join('');

  // Restore stashed tokens
  html = html.replace(/\u0000(\d+)\u0000/g, (_m, idx) => placeholders[Number(idx)] || '');

  return html;
}

/**
 * Parse markdown into simple segments for native rendering.
 * Returns an array of { type, text, url? } segments.
 */
export type MarkdownSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'hashtag'; text: string; tag: string }
  | { type: 'mention'; text: string; username: string }
  | { type: 'break' };

export function parseMarkdownSegments(text: string): MarkdownSegment[] {
  if (!text) return [];
  // Render line-start bullet markers as real bullets on native (the inline
  // tokenizer below has no block/list concept). "- item" / "* item" → "• item".
  text = text.replace(/^[ \t]*[-*]\s+/gm, '• ');
  const segments: MarkdownSegment[] = [];
  // Simple regex-based tokenizer.
  // Order matters: markdown link `[text](url)` is matched before the bare URL
  // pattern so that URLs inside markdown brackets aren't double-linkified.
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(?:^|\s)(#([a-zA-Z0-9_]+))|(\n)|(\bhttps?:\/\/[^\s<>()\[\]"']+)|((?:^|\s))(@([a-zA-Z0-9_]+))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add preceding text
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Bold
      segments.push({ type: 'bold', text: match[2] });
    } else if (match[3]) {
      // Italic
      segments.push({ type: 'italic', text: match[4] });
    } else if (match[5]) {
      // Code
      segments.push({ type: 'code', text: match[6] });
    } else if (match[7]) {
      // Markdown link [text](url) — unsafe schemes stay plain text so they
      // never reach Linking.openURL on native or an href on web.
      if (isSafeUrl(match[9])) {
        segments.push({ type: 'link', text: match[8], url: match[9] });
      } else {
        segments.push({ type: 'text', text: match[7] });
      }
    } else if (match[10]) {
      // Hashtag
      segments.push({ type: 'hashtag', text: `#${match[11]}`, tag: match[11] });
    } else if (match[12]) {
      // Line break
      segments.push({ type: 'break' });
    } else if (match[13]) {
      // Bare URL — strip common trailing punctuation so sentences render cleanly
      let url = match[13];
      let trailing = '';
      const trailers = ['.', ',', ';', ':', '!', '?', ')', ']'];
      while (url.length > 0 && trailers.includes(url[url.length - 1])) {
        trailing = url[url.length - 1] + trailing;
        url = url.slice(0, -1);
      }
      segments.push({ type: 'link', text: url, url });
      if (trailing) segments.push({ type: 'text', text: trailing });
    } else if (match[15]) {
      // @mention — re-emit the captured leading whitespace (so it doesn't glue
      // to the prior word) then the linkified handle.
      if (match[14]) segments.push({ type: 'text', text: match[14] });
      segments.push({ type: 'mention', text: `@${match[16]}`, username: match[16] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}
