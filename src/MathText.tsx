import React from 'react';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import remarkMath from 'remark-math';
// @ts-ignore
import remarkGfm from 'remark-gfm';
// @ts-ignore
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text: string;
}

const MathText: React.FC<MathTextProps> = ({ text }) => {
  return (
    <div className="math-text-container" style={{ fontSize: '1rem', lineHeight: '1.6' }}>
      {/* @ts-ignore - ReactMarkdown JSX component type mismatch in some TS versions */}
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default MathText;
