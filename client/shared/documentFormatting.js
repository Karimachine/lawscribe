// Lightweight, regex-based parser for the markdown-ish structure Claude's
// document generation produces (see api/generate.js's prompt: "Write a
// complete {documentType} document..." with no explicit formatting
// instruction either way, so it defaults to headers/bold/lists). Not a
// full markdown parser -- no links, tables, nested lists, code blocks --
// deliberately just enough to cover what these generated documents
// actually contain.
//
// Pure, framework-agnostic parsing only -- no React, no @react-pdf, no
// DOM APIs. Lives here (a sibling of both api/ and src/, not inside
// either) specifically so it can be shared by both consumers without
// either importing across the frontend/backend boundary:
//   - src/components/shared/DocumentContent.jsx (read-only View modal,
//     renders parsed blocks to JSX)
//   - api/_lib/documentPdf.js (server-side PDF route, renders the same
//     parsed blocks to @react-pdf primitives)
// One parser, so a future format change (e.g. numbered lists) can't drift
// between what the View shows and what the PDF contains.

export function parseDocumentContent(content) {
  const text = content || '';
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseBlock);
}

function parseBlock(block) {
  const headingMatch = block.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    return { type: 'heading', level: headingMatch[1].length, text: headingMatch[2].trim() };
  }

  const lines = block.split('\n').map((line) => line.trim());
  const isList = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
  if (isList) {
    return { type: 'list', items: lines.map((line) => line.replace(/^[-*]\s+/, '')) };
  }

  // Soft-wrapped lines within one paragraph collapse to a single line --
  // Claude's output wraps prose at arbitrary column widths, not at
  // intended line breaks.
  return { type: 'paragraph', text: block.replace(/\s*\n\s*/g, ' ') };
}

// Splits inline text on **bold** spans into ordered { text, bold } runs
// so a renderer can map each run to a styled/plain text node without its
// own regex handling.
export function parseInlineFormatting(text) {
  const runs = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false });
  }

  return runs.length ? runs : [{ text, bold: false }];
}
