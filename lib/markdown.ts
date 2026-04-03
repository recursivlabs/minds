import { Platform } from 'react-native';

/**
 * Simple markdown-to-HTML converter for web.
 * Handles: **bold**, *italic*, `code`, [links](url), and line breaks.
 * No external dependencies.
 */
export function renderMarkdownToHtml(text: string): string {
  if (!text) return '';

  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (triple backtick) — must come before inline code
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#1a1a1e;padding:8px 12px;border-radius:6px;overflow-x:auto;font-family:monospace;font-size:13px;color:#a0a0a8;margin:8px 0"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#1a1a1e;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;color:#a0a0a8">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#d4a844;text-decoration:underline">$1</a>')
    // Headings (### h3, ## h2, # h1)
    .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:600;margin:12px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:600;margin:12px 0 4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:700;margin:12px 0 4px">$1</h1>')
    // Line breaks
    .replace(/\n/g, '<br />');

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
  | { type: 'break' };

export function parseMarkdownSegments(text: string): MarkdownSegment[] {
  if (!text) return [];
  const segments: MarkdownSegment[] = [];
  // Simple regex-based tokenizer
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(\n)/g;
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
      // Link
      segments.push({ type: 'link', text: match[8], url: match[9] });
    } else if (match[10]) {
      // Line break
      segments.push({ type: 'break' });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}
