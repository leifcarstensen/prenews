/**
 * Renders markdown article body as HTML.
 * Simple server-side markdown renderer — no external dependencies.
 * Supports: **bold**, *italic*, ## headings, paragraphs, and line breaks.
 */
export function ArticleBody({ content }: { content: string }) {
  const html = markdownToHtml(content);

  return (
    <div
      className="article-body rounded-[10px] border border-border bg-card p-5 text-sm leading-relaxed text-text-secondary [&_h2]:text-text [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-text [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-3 [&_strong]:text-text [&_strong]:font-medium [&_em]:italic [&_a]:text-accent [&_a]:underline [&_a:hover]:text-accent-hover"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function markdownToHtml(md: string): string {
  return md
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";

      // Headings
      if (trimmed.startsWith("### ")) {
        return `<h3>${inlineFormat(trimmed.slice(4))}</h3>`;
      }
      if (trimmed.startsWith("## ")) {
        return `<h2>${inlineFormat(trimmed.slice(3))}</h2>`;
      }

      // Paragraph
      return `<p>${inlineFormat(trimmed.replace(/\n/g, "<br/>"))}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
