import React from 'react';
import { DiffBlock } from '../types';

// Function to parse unified diff to side-by-side format
export const parseDiffToSideBySide = (diffText: string): DiffBlock[] => {
  // Handle special cases with detailed content
  if (diffText.startsWith("File was added in this commit:") || 
      diffText.startsWith("File was deleted in this commit. Previous content:") ||
      diffText.startsWith("Initial commit, file added:")) {
    
    const parts = diffText.split("\n\n");
    if (parts.length >= 2) {
      const message = parts[0];
      const content = parts.slice(1).join("\n\n");
      
      // Create a block that shows the content as either all additions or all removals
      const isAddition = diffText.startsWith("File was added") || diffText.startsWith("Initial commit");
      
      return [{
        header: message,
        removed: isAddition ? [] : content.split('\n'),
        added: isAddition ? content.split('\n') : [],
        removedLineNumbers: isAddition ? [] : Array.from({length: content.split('\n').length}, (_, i) => i + 1),
        addedLineNumbers: isAddition ? Array.from({length: content.split('\n').length}, (_, i) => i + 1) : []
      }];
    }
  }
  
  // Handle other special case messages
  if (diffText === "Binary file (no text diff available)" || 
      diffText === "File was added in this commit (binary content)" ||
      diffText === "File was deleted in this commit (binary content)" ||
      diffText === "Binary file or encoding error" ||
      diffText === "No changes detected in this file for this commit" ||
      diffText === "File metadata changed (permissions or mode)" ||
      diffText.startsWith("File was renamed in this commit") ||
      diffText.startsWith("Could not retrieve diff:") ||
      diffText.startsWith("Error retrieving diff:")) {
    
    return [{
      header: diffText,
      removed: [],
      added: [],
      removedLineNumbers: [],
      addedLineNumbers: []
    }];
  }
  
  // Regular diff processing for standard git diffs
  const lines = diffText.split('\n');
  const blocks: DiffBlock[] = [];
  
  let currentBlock = {
    header: null as string | null,
    removed: [] as string[],
    added: [] as string[],
    removedLineNumbers: [] as number[],
    addedLineNumbers: [] as number[]
  };
  
  let lineNumberLeft = 0;
  let lineNumberRight = 0;
  
  lines.forEach(line => {
    // Handle diff headers
    if (line.startsWith('@@') && line.includes('@@')) {
      // Extract line numbers from diff header
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        lineNumberLeft = parseInt(match[1]);
        lineNumberRight = parseInt(match[2]);
      }
      
      // If we have content in the current block, push it and start a new one
      if (currentBlock.removed.length > 0 || currentBlock.added.length > 0) {
        blocks.push({...currentBlock});
        currentBlock = {
          header: null,
          removed: [],
          added: [],
          removedLineNumbers: [],
          addedLineNumbers: []
        };
      }
      
      currentBlock.header = line;
      return;
    }
    
    // Handle file headers
    if (line.startsWith('---') || line.startsWith('+++')) {
      return; // Skip file headers in the side-by-side view
    }
    
    // Handle content lines
    if (line.startsWith('-')) {
      // Line was removed
      currentBlock.removed.push(line.substring(1));
      currentBlock.removedLineNumbers.push(lineNumberLeft);
      lineNumberLeft++;
    } else if (line.startsWith('+')) {
      // Line was added
      currentBlock.added.push(line.substring(1));
      currentBlock.addedLineNumbers.push(lineNumberRight);
      lineNumberRight++;
    } else {
      // Context line - increment both line numbers but don't show in diff
      // We want to focus only on changed lines
      lineNumberLeft++;
      lineNumberRight++;
    }
  });
  
  // Add the last block if it has content
  if (currentBlock.removed.length > 0 || currentBlock.added.length > 0) {
    blocks.push(currentBlock);
  }
  
  // If no blocks were created but we had input, create a default block
  if (blocks.length === 0 && diffText.trim().length > 0 && 
      !diffText.startsWith("Binary") && 
      !diffText.startsWith("File was") && 
      !diffText.startsWith("Could not") && 
      !diffText.startsWith("Error")) {
    blocks.push({
      header: "Changes",
      removed: [],
      added: diffText.split('\n'),
      removedLineNumbers: [],
      addedLineNumbers: Array.from({length: diffText.split('\n').length}, (_, i) => i + 1)
    });
  }
  
  return blocks;
};

// Render the diff block with proper line numbers and coloring
export const renderDiffBlock = (diffBlock: DiffBlock, filePath: string, blockIdx: number): JSX.Element => {
  const fileExtension = filePath.split('.').pop() || '';
  
  // If the diff block has a header that's a special message, display it specially
  if (diffBlock.header && !diffBlock.header.startsWith('@@')) {
    return (
      <div key={blockIdx} className="mb-4">
        <div className="py-2 px-3 bg-gray-800 rounded text-gray-300">
          {diffBlock.header}
        </div>
      </div>
    );
  }
  
  return (
    <div key={blockIdx} className="mb-4">
      {diffBlock.header && diffBlock.header.startsWith('@@') && (
        <div className="text-gray-400 font-mono text-xs mb-1">
          {diffBlock.header}
        </div>
      )}
      <div className="flex flex-row border border-gray-700 rounded overflow-hidden">
        {/* Left side (removed) */}
        <div className="w-1/2 border-r border-gray-700 bg-red-900/20">
          <table className="w-full">
            <tbody>
              {diffBlock.removed.map((line: string, idx: number) => (
                <tr key={`left-${idx}`} className="hover:bg-red-900/40">
                  <td className="px-1 text-right text-gray-500 select-none border-r border-gray-700 bg-gray-800/50 w-10">
                    {diffBlock.removedLineNumbers[idx]}
                  </td>
                  <td className="px-2 font-mono whitespace-pre-wrap overflow-x-auto text-red-300">
                    {line}
                  </td>
                </tr>
              ))}
              {diffBlock.removed.length === 0 && (
                <tr>
                  <td className="px-1 text-right text-gray-500 select-none border-r border-gray-700 bg-gray-800/50 w-10"></td>
                  <td className="px-2 py-1 italic text-gray-500">No removals</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Right side (added) */}
        <div className="w-1/2 bg-green-900/20">
          <table className="w-full">
            <tbody>
              {diffBlock.added.map((line: string, idx: number) => (
                <tr key={`right-${idx}`} className="hover:bg-green-900/40">
                  <td className="px-1 text-right text-gray-500 select-none border-r border-gray-700 bg-gray-800/50 w-10">
                    {diffBlock.addedLineNumbers[idx]}
                  </td>
                  <td className="px-2 font-mono whitespace-pre-wrap overflow-x-auto text-green-300">
                    {line}
                  </td>
                </tr>
              ))}
              {diffBlock.added.length === 0 && (
                <tr>
                  <td className="px-1 text-right text-gray-500 select-none border-r border-gray-700 bg-gray-800/50 w-10"></td>
                  <td className="px-2 py-1 italic text-gray-500">No additions</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/**
 * Get language from file path for syntax highlighting
 */
export const getLanguageFromPath = (path: string): string => {
  const extension = path.split('.').pop() || '';
  const languageMap: {[key: string]: string} = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'sh': 'bash',
    'bash': 'bash',
  };
  
  return languageMap[extension] || 'text';
}; 