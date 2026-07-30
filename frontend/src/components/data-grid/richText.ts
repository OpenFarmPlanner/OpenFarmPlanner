const emptyMarkdownValues = new Set(['', '<p></p>', '<p><br></p>']);

export function normalizeRichTextMarkdown(value: string | null | undefined): string {
  const normalized = (value ?? '').trim();
  return emptyMarkdownValues.has(normalized) ? '' : value ?? '';
}
