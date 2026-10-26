import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaProps {
  tex: string;
  inline?: boolean;
}

// The TeX is written in this codebase, never taken from users, so rendering KaTeX's HTML directly is safe
export const Formula: React.FC<FormulaProps> = ({ tex, inline = false }) => {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: !inline, throwOnError: true }), [tex, inline]);
  return inline ? (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <div className="overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />
  );
};
