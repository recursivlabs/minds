import { Platform } from 'react-native';

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

  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (triple backtick) — must come before inline code
    .replace(/```([\s\S]*?)```/g, (_m, code) => stash(`<pre style="background:#1a1a1e;padding:8px 12px;border-radius:6px;overflow-x:auto;font-family:monospace;font-size:13px;color:#a0a0a8;margin:8px 0"><code>${code}</code></pre>`))
    // Inline code
    .replace(/`([^`]+)`/g, (_m, code) => stash(`<code style="background:#1a1a1e;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;color:#a0a0a8">${code}</code>`))
    // Markdown links [text](url) — stash so bare-URL pass doesn't re-match them
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => stash(`<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#d4a844;text-decoration:underline">${label}</a>`))
    // Bare URLs (http/https). Must come BEFORE bold/italic so e.g. `**https://x.com**`
    // still linkifies correctly. Strip common trailing punctuation so sentences
    // render cleanly (. , ; : ! ? ) ]).
    .replace(/\bhttps?:\/\/[^\s<>()\[\]"']+/g, (m) => {
      let url = m;
      let trailing = '';
      const trailers = ['.', ',', ';', ':', '!', '?', ')', ']'];
      while (url.length > 0 && trailers.includes(url[url.length - 1])) {
        trailing = url[url.length - 1] + trailing;
        url = url.slice(0, -1);
      }
      return `${stash(`<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#d4a844;text-decoration:underline">${url}</a>`)}${trailing}`;
    })
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headings (### h3, ## h2, # h1)
    .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:600;margin:12px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:600;margin:12px 0 4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:700;margin:12px 0 4px">$1</h1>')
    // Hashtags — color only, no underline (prevents browser default <a> underline)
    .replace(/(^|\s)#([a-zA-Z0-9_]+)/g, (_m, lead, tag) => `${lead}${stash(`<a href="/(tabs)/discover?tab=posts&q=%23${tag}" style="color:#d4a844;text-decoration:none">#${tag}</a>`)}`)
    // Line breaks
    .replace(/\n/g, '<br />');

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
  | { type: 'break' };

export function parseMarkdownSegments(text: string): MarkdownSegment[] {
  if (!text) return [];
  const segments: MarkdownSegment[] = [];
  // Simple regex-based tokenizer.
  // Order matters: markdown link `[text](url)` is matched before the bare URL
  // pattern so that URLs inside markdown brackets aren't double-linkified.
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(?:^|\s)(#([a-zA-Z0-9_]+))|(\n)|(\bhttps?:\/\/[^\s<>()\[\]"']+)/g;
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
      // Markdown link [text](url)
      segments.push({ type: 'link', text: match[8], url: match[9] });
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
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}
