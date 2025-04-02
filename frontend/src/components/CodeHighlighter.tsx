import React from 'react';
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface CodeHighlighterProps {
  language?: string;
  style?: any;
  customStyle?: React.CSSProperties;
  children: string;
}

export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
  language,
  style = atomDark,
  customStyle,
  children
}) => {
  return (
    // @ts-ignore - Ignore TypeScript errors for SyntaxHighlighter
    <SyntaxHighlighter
      language={language}
      style={style}
      customStyle={customStyle}
    >
      {children}
    </SyntaxHighlighter>
  );
};

export default CodeHighlighter; 