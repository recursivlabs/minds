import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml, parseMarkdownSegments } from '../markdown';

describe('renderMarkdownToHtml', () => {
  it('renders "-" bullet lists as <ul><li> (regression: raw markers used to leak)', () => {
    const html = renderMarkdownToHtml('- one\n- two');
    expect(html).toContain('<ul');
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).not.toContain('- one');
  });

  it('renders "*" bullets and numbered lists', () => {
    expect(renderMarkdownToHtml('* a\n* b')).toContain('<ul');
    const ol = renderMarkdownToHtml('1. first\n2. second');
    expect(ol).toContain('<ol');
    expect(ol.match(/<li/g)?.length).toBe(2);
  });

  it('renders bold, italic, headings, and links', () => {
    expect(renderMarkdownToHtml('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdownToHtml('*it*')).toContain('<em>it</em>');
    expect(renderMarkdownToHtml('# Title')).toContain('<h1');
    expect(renderMarkdownToHtml('### Small')).toContain('<h3');
    const link = renderMarkdownToHtml('[text](https://x.com)');
    expect(link).toContain('href="https://x.com"');
    expect(link).toContain('>text</a>');
  });

  it('escapes HTML to prevent injection', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdownToHtml('')).toBe('');
  });
});

describe('parseMarkdownSegments', () => {
  it('parses bold segments', () => {
    const segs = parseMarkdownSegments('hi **there**');
    expect(segs.some((s) => s.type === 'bold' && (s as any).text === 'there')).toBe(true);
  });

  it('converts line-start bullets to a bullet glyph for native', () => {
    const segs = parseMarkdownSegments('- item');
    const text = segs.map((s) => (s as any).text || '').join('');
    expect(text).toContain('•'); // •
    expect(text).not.toMatch(/^-\s/);
  });
});
