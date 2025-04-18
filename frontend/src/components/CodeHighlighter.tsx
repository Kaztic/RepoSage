import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface CodeHighlighterProps {
  language?: string;
  style?: any;
  customStyle?: React.CSSProperties;
  children: string;
  showLineNumbers?: boolean;
  className?: string;
}

const codeStyle = {
  ...atomDark,
  'pre[class*="language-"]': {
    ...atomDark['pre[class*="language-"]'],
    background: 'var(--surface-900)',
    borderRadius: '0.375rem',
    padding: '1rem',
    margin: '0.5rem 0',
    border: '1px solid var(--surface-700)',
  },
  'code[class*="language-"]': {
    ...atomDark['code[class*="language-"]'],
    background: 'var(--surface-900)',
    fontFamily: "'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace",
    fontSize: '0.875rem',
  }
};

export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
  language = 'typescript',
  style = codeStyle,
  customStyle = {},
  children,
  showLineNumbers = false,
  className = '',
}) => {
  return (
    <div className={`code-highlighter ${className}`}>
      <SyntaxHighlighter
        language={language}
        style={style}
        customStyle={{
          borderRadius: 'var(--ui-border-radius)',
          boxShadow: 'var(--shadow-sm)',
          ...customStyle
        }}
        showLineNumbers={showLineNumbers}
        wrapLongLines={true}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeHighlighter; 