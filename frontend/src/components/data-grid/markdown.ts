/**
 * Markdown utility functions for notes fields.
 *
 * Provides helper functions to strip markdown syntax and generate plain text excerpts.
 */

// Matches internal AI citation markers of the form 【digits†identifier】
const CITATION_MARKER_RE = /\s*【[^】]*†[^】]*】/g;
const FOOTNOTE_DEFINITION_RE = /^\s*\[\^([^\]]+)\]:\s*(.*)$/;
const FOOTNOTE_REFERENCE_RE = /\[\^([^\]]+)\]/g;

/**
 * Remove AI-generated citation markers (e.g. 【941131680077198†L4162-L4178】) from text.
 * These are internal retrieval references that should not be shown to users.
 *
 * Kept even though the AI enrichment feature that used to generate these markers
 * was removed (see git history: "Remove AI enrichment feature") — existing notes
 * saved while that feature was active can still contain markers, so this stays a
 * defensive display-time cleanup rather than dead code.
 */
export function stripCitationMarkers(text: string): string {
  if (!text) return text;
  return text.replace(CITATION_MARKER_RE, '');
}

export interface SourceLinkedMarkdown {
  markdown: string;
  sourceReferenceCount: number;
}

/**
 * Convert Markdown footnote references into internal source links.
 *
 * OpenFarmPlanner notes use ordinary Markdown footnote syntax to keep source
 * references close to the sentence, but the UI points those references to the
 * existing "Quellen" list instead of rendering a separate footnotes section.
 */
export function prepareSourceLinkedMarkdown(markdown: string): SourceLinkedMarkdown {
  if (!markdown) {
    return { markdown: '', sourceReferenceCount: 0 };
  }

  const footnoteIndexes = new Map<string, number>();
  const lines: string[] = [];

  for (const line of markdown.split('\n')) {
    const definitionMatch = line.match(FOOTNOTE_DEFINITION_RE);
    if (definitionMatch) {
      const [, id] = definitionMatch;
      if (!footnoteIndexes.has(id)) {
        footnoteIndexes.set(id, footnoteIndexes.size + 1);
      }
      continue;
    }

    lines.push(line);
  }

  if (footnoteIndexes.size === 0) {
    return { markdown, sourceReferenceCount: 0 };
  }

  const linkedMarkdown = lines
    .join('\n')
    .replace(FOOTNOTE_REFERENCE_RE, (match, id: string) => {
      const index = footnoteIndexes.get(id);
      return index ? `[${index}](#ofp-source-${index})` : match;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    markdown: linkedMarkdown,
    sourceReferenceCount: footnoteIndexes.size,
  };
}

/**
 * Strip common markdown syntax tokens from text.
 * Removes headers, bold, italic, links, code blocks, lists, etc.
 * 
 * @param markdown The markdown text to strip
 * @returns Plain text without markdown syntax
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  let text = markdown;
  
  // Remove code blocks (```...``` and `...`)
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  
  // Remove headers (# ## ###, etc.)
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  // Remove bold and italic (**text**, *text*, __text__, _text_)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  
  // Remove links [text](url)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  
  // Remove horizontal rules (---, ***, ___)
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  
  // Remove list markers (-, *, +, numbers)
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  
  // Remove blockquotes (>)
  text = text.replace(/^>\s+/gm, '');
  
  // Normalize whitespace
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.trim();
  
  return text;
}

/**
 * Get a plain text excerpt from markdown, stripping syntax.
 * Useful for tooltips and previews.
 * 
 * @param markdown The markdown text to excerpt
 * @param maxLength Maximum length of the excerpt (default: 120)
 * @returns Plain text excerpt, truncated if necessary
 */
export function getPlainExcerpt(markdown: string, maxLength: number = 120): string {
  if (!markdown || markdown.trim() === '') {
    return '';
  }
  
  const plain = stripMarkdown(markdown);
  
  if (plain.length <= maxLength) {
    return plain;
  }
  
  // Truncate and add ellipsis
  return plain.substring(0, maxLength).trim() + '...';
}
