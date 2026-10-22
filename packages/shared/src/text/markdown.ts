// packages/shared/src/text/markdown.ts
// A small, pure Markdown reader for assistant replies (#332): the same subset the web
// renderer shows — headings, bold, italic, inline code, bullet and numbered lists —
// returned as plain data so each platform draws it with its own text components.
// Links follow the reply guard: only [label](https://…) markdown links become links;
// anything else stays text. Tables are not drawn on the phone yet; their rows fall
// back to plain paragraph lines without the edge pipes.

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; url: string };

export type MarkdownBlock =
  | { kind: "heading"; level: number; segments: InlineSegment[] }
  | { kind: "paragraph"; segments: InlineSegment[] }
  | { kind: "bullet-list"; items: InlineSegment[][] }
  | { kind: "numbered-list"; items: InlineSegment[][] };

// The link alternative comes first so a linked label is never read as emphasis. The
// single * and _ rules match the web renderer: they only count at a word edge with
// text right after the opener, so snake_case_name and "2 * 3 * 4" stay as typed.
const INLINE_RE =
  /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|(?<![\w*])\*[^*\s][^*]*\*(?![\w*])|(?<![\w_])_[^_\s][^_]*_(?![\w_]))/g;
const LINK_RE = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

export function parseInlineMarkdown(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ kind: "text", text: text.slice(lastIndex, index) });
    const link = token.match(LINK_RE);
    if (link) {
      segments.push({ kind: "link", text: link[1], url: link[2] });
    } else if (
      (token.startsWith("**") && token.endsWith("**") && token.length >= 4) ||
      (token.startsWith("__") && token.endsWith("__") && token.length >= 4)
    ) {
      segments.push({ kind: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      segments.push({ kind: "code", text: token.slice(1, -1) });
    } else if (token.length >= 2) {
      segments.push({ kind: "italic", text: token.slice(1, -1) });
    } else {
      segments.push({ kind: "text", text: token });
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) segments.push({ kind: "text", text: text.slice(lastIndex) });
  return segments;
}

const BULLET_RE = /^\s*[-*]\s+/;
const NUMBERED_RE = /^\s*\d+\.\s+/;
const HEADING_RE = /^(#{1,4})\s+(\S.*)$/;

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        segments: parseInlineMarkdown(heading[2]),
      });
      i++;
      continue;
    }

    if (BULLET_RE.test(line)) {
      const items: InlineSegment[][] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(parseInlineMarkdown(lines[i].replace(BULLET_RE, "")));
        i++;
      }
      blocks.push({ kind: "bullet-list", items });
      continue;
    }

    if (NUMBERED_RE.test(line)) {
      const items: InlineSegment[][] = [];
      while (i < lines.length && NUMBERED_RE.test(lines[i])) {
        items.push(parseInlineMarkdown(lines[i].replace(NUMBERED_RE, "")));
        i++;
      }
      blocks.push({ kind: "numbered-list", items });
      continue;
    }

    // A paragraph runs until a blank line or a block start. Table rows lose their
    // edge pipes and read as plain lines.
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING_RE.test(lines[i].trim()) &&
      !BULLET_RE.test(lines[i]) &&
      !NUMBERED_RE.test(lines[i])
    ) {
      const raw = lines[i].trim();
      paragraphLines.push(raw.startsWith("|") ? raw.replace(/^\|/, "").replace(/\|$/, "").replace(/\|/g, " · ") : raw);
      i++;
    }
    blocks.push({ kind: "paragraph", segments: parseInlineMarkdown(paragraphLines.join(" ")) });
  }

  return blocks;
}
