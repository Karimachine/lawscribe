import { parseDocumentContent, parseInlineFormatting } from '../../../shared/documentFormatting';

// Renders a document's raw stored content (the markdown-ish text
// generate.js's prompt produces) with basic formatting -- real headings
// and bold text instead of literal "#"/"**" characters. Deliberately
// plain <p> elements with size/weight classes rather than semantic
// <h1>-<h6> tags: this renders inside a modal that sits within the
// page's own heading hierarchy, and a document's own "# TITLE" heading
// would otherwise pollute that outline.
function InlineText({ text }) {
  return parseInlineFormatting(text).map((run, i) =>
    run.bold ? <strong key={i}>{run.text}</strong> : <span key={i}>{run.text}</span>
  );
}

function DocumentContent({ content }) {
  const blocks = parseDocumentContent(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="document-content">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <p key={i} className={`doc-heading doc-heading-${Math.min(block.level, 3)}`}>
              <InlineText text={block.text} />
            </p>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

export default DocumentContent;
