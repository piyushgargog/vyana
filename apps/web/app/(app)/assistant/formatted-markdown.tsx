"use client";

import React, { ReactNode } from "react";
import { cn } from "@/components/ui";

/**
 * Pure helper to render inline Markdown formatting:
 * - Bold: `**text**` or `__text__`
 * - Italic: `*text*` or `_text_`
 * - Inline code: `` `code` ``
 */
export function renderInlineMarkdown(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  // Single * and _ only count as italic at a word edge and with text right after the opener: snake_case_name and "2 * 3 * 4" stay as typed.
  const tokenRegex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|(?<![\w*])\*[^*\s][^*]*\*(?![\w*])|(?<![\w_])_[^_\s][^_]*_(?![\w_]))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `inline-${match.index}`;

    if (
      (token.startsWith("**") && token.endsWith("**") && token.length >= 4) ||
      (token.startsWith("__") && token.endsWith("__") && token.length >= 4)
    ) {
      elements.push(
        <strong key={key} className="font-semibold text-label">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      elements.push(
        <code
          key={key}
          className="rounded bg-fill px-1.5 py-0.5 text-[13px] font-mono text-label"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*") && token.length >= 2) ||
      (token.startsWith("_") && token.endsWith("_") && token.length >= 2)
    ) {
      elements.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      elements.push(token);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

function parseTableCells(rowStr: string): string[] {
  const trimmed = rowStr.trim();
  const stripped = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return stripped.split("|").map((c) => c.trim());
}

function isTableDelimiter(rowStr: string): boolean {
  const cells = parseTableCells(rowStr);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2;
}

/**
 * FormattedMarkdown renders assistant replies with proper typography:
 * - Bold, italic, code
 * - Markdown tables
 * - Bulleted and numbered lists
 * - Headings
 */
export function FormattedMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Headings (#, ##, ###)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(\S.*)$/); // \S after the spaces: no overlap with \s+, so no slow backtracking
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      const headingClass =
        level === 1
          ? "text-[18px] font-semibold text-label mt-3 mb-1"
          : level === 2
          ? "text-[17px] font-semibold text-label mt-3 mb-1"
          : "text-[15px] font-semibold text-label mt-2.5 mb-1";
      blocks.push(
        <div key={`h-${i}`} className={headingClass} role="heading" aria-level={Math.min(level + 1, 6)}>
          {renderInlineMarkdown(title)}
        </div>
      );
      i++;
      continue;
    }

    // 3. Tables (starts with | and has delimiter)
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
      const headerRow = parseTableCells(trimmed);
      i += 2; // skip header and delimiter

      const dataRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        dataRows.push(parseTableCells(lines[i]));
        i++;
      }

      blocks.push(
        <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-card border border-separator">
          <table className="w-full border-collapse text-[14px]">
            <thead className="bg-fill border-b border-separator text-left font-semibold text-label">
              <tr>
                {headerRow.map((cell, cIdx) => (
                  <th
                    key={cIdx}
                    className="px-3 py-2 border-r border-separator last:border-r-0"
                  >
                    {renderInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-separator text-label-2">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-fill/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3 py-2 border-r border-separator last:border-r-0"
                    >
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. Bullet lists (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1 pl-5 list-disc text-label">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 5. Numbered lists (1. 2. etc.)
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1 pl-5 list-decimal text-label">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 6. Regular paragraph
    const paragraphLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isTableRow(lines[i]) &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed text-[15px] text-label">
        {paragraphLines.map((pLine, lIdx) => (
          <React.Fragment key={lIdx}>
            {lIdx > 0 && <br />}
            {renderInlineMarkdown(pLine)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className={cn("space-y-1", className)}>{blocks}</div>;
}
