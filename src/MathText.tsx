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
  // Pre-process text to ensure tables are recognized. 
  // Gemini sometimes forgets to put a blank line before a table.
  // We find the first row of a table (e.g., | Header |) and ensure a blank line before it.
  const processedText = text ? text.replace(/([^\n])\n(\s*\|)/g, '$1\n\n$2') : '';

  return (
    <div className="math-text-container" style={{ fontSize: '1rem', lineHeight: '1.6' }}>
      {/* @ts-ignore - ReactMarkdown JSX component type mismatch in some TS versions */}
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({node, ...props}: any) => (
            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #e2e8f0' }} {...props} />
            </div>
          ),
          th: ({node, ...props}: any) => (
            <th style={{ border: '1px solid #e2e8f0', padding: '12px', backgroundColor: '#f8fafc', fontWeight: '600', textAlign: 'left' }} {...props} />
          ),
          td: ({node, ...props}: any) => (
            <td style={{ border: '1px solid #e2e8f0', padding: '12px' }} {...props} />
          )
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
};

export default MathText;
