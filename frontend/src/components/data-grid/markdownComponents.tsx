import type { Components } from 'react-markdown';

/**
 * Shared `react-markdown` component overrides for rendered notes.
 *
 * Links inside notes point to external sources (seed suppliers, cultivation
 * guides), so they must open in a new tab instead of replacing the app.
 */
export const markdownComponents: Components = {
  a: ({ node, ...props }) => {
    void node;
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
};
