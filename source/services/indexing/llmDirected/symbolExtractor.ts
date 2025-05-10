// source/services/indexing/llmDirected/symbolExtractor.ts

import * as path from 'path';
import { ExtractionPattern } from './agentProtocol.js';
import { CodeSymbol } from '../types.js';

/**
 * The SymbolExtractor class is responsible for extracting symbols from code chunks
 * based on patterns defined by the LLM.
 */
export class SymbolExtractor {
  /**
   * Extracts symbols from a chunk of code using the provided extraction pattern
   */
  async extractSymbols(
    filePath: string,
    chunk: { content: string; startLine: number; endLine: number; type?: string },
    pattern: ExtractionPattern
  ): Promise<CodeSymbol[]> {
    try {
      console.log(`Executing extraction pattern of type: ${pattern.type} for ${path.basename(filePath)}`);
      
      // Apply the appropriate extraction method based on pattern type
      switch (pattern.type.toLowerCase()) {
        case 'regex':
          return this.extractWithRegex(filePath, chunk, pattern);
        
        case 'ast':
          return this.extractWithAst(filePath, chunk, pattern);
        
        case 'semantic':
          return this.extractWithSemantic(filePath, chunk, pattern);
          
        default:
          // For unknown pattern types, use a generic approach
          return this.extractWithGenericPattern(filePath, chunk, pattern);
      }
    } catch (error) {
      console.error(`Error extracting symbols using ${pattern.type} pattern:`, error);
      return [];
    }
  }
  
  /**
   * Extracts symbols using regular expressions
   */
  private extractWithRegex(
    filePath: string,
    chunk: { content: string; startLine: number; endLine: number; type?: string },
    pattern: ExtractionPattern
  ): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const content = chunk.content;
    
    try {
      // Get regex pattern from definition
      const regexPattern = pattern.definition['pattern'] || '';
      const flags = pattern.definition['flags'] || 'g';
      
      if (!regexPattern) {
        console.error('No regex pattern defined for extraction');
        return [];
      }
      
      // Create regex
      const regex = new RegExp(regexPattern, flags);
      
      // Find all matches
      let match;
      while ((match = regex.exec(content)) !== null) {
        // If the regex has capture groups, use them for extraction
        if (match.length > 1) {
          // For most programming language patterns, the first capture group is typically the symbol name
          const name = match[1] || 'unnamed';
          
          // Calculate location
          const beforeMatchContent = content.substring(0, match.index || 0);
          const lineOffset = (beforeMatchContent.match(/\n/g) || []).length;
          const startLine = chunk.startLine + lineOffset;
          
          const matchContent = match[0] || '';
          const matchLines = (matchContent.match(/\n/g) || []).length;
          const endLine = startLine + matchLines;
          
          // Calculate approximate column positions
          const lastNewlinePos = beforeMatchContent.lastIndexOf('\n');
          const startColumn = lastNewlinePos === -1 
            ? (match.index || 0) + 1 
            : (match.index || 0) - lastNewlinePos;
          
          const endColumn = startColumn + (matchContent.length > 0 ? matchContent.length : 1);
          
          // Determine symbol type based on pattern or chunk type
          let symbolType = pattern.targetSymbolTypes[0] || 'unknown';
          
          // Refine type based on content if possible
          if (symbolType === 'unknown' && chunk.type) {
            symbolType = this.normalizeSymbolType(chunk.type);
          }
          
          // Create the symbol
          const symbol: CodeSymbol = {
            name,
            type: symbolType as any, // Cast to the expected type
            location: {
              filePath,
              startLine,
              endLine,
              startColumn,
              endColumn
            },
            content: match[0]
          };
          
          // Add additional properties if captured
          if (match[2]) {
            symbol.signature = match[2];
          }
          
          // Capture any other groups as additional properties
          if (match.length > 3) {
            const extraProps: Record<string, any> = {};
            for (let i = 3; i < match.length; i++) {
              const propName = pattern.definition[`group${i}Name`] || `capture${i}`;
              extraProps[propName] = match[i];
            }
            // Add as optional properties
            Object.assign(symbol, { properties: extraProps });
          }
          
          symbols.push(symbol);
        } else {
          // If no capture groups, use the whole match
          const name = this.extractNameFromMatch(match[0], pattern);
          
          // Calculate location
          const beforeMatchContent = content.substring(0, match.index || 0);
          const lineOffset = (beforeMatchContent.match(/\n/g) || []).length;
          const startLine = chunk.startLine + lineOffset;
          
          const matchContent = match[0] || '';
          const matchLines = (matchContent.match(/\n/g) || []).length;
          const endLine = startLine + matchLines;
          
          // Calculate approximate column positions
          const lastNewlinePos = beforeMatchContent.lastIndexOf('\n');
          const startColumn = lastNewlinePos === -1 
            ? (match.index || 0) + 1 
            : (match.index || 0) - lastNewlinePos;
          
          const endColumn = startColumn + (matchContent.length > 0 ? matchContent.length : 1);
          
          // Determine symbol type based on pattern or chunk type
          let symbolType = pattern.targetSymbolTypes[0] || 'unknown';
          
          // Refine type based on content if possible
          if (symbolType === 'unknown' && chunk.type) {
            symbolType = this.normalizeSymbolType(chunk.type);
          }
          
          symbols.push({
            name,
            type: symbolType as any, // Cast to the expected type
            location: {
              filePath,
              startLine,
              endLine,
              startColumn,
              endColumn
            },
            content: match[0]
          });
        }
      }
      
      return this.applyRefinements(symbols, pattern);
    } catch (error) {
      console.error('Error in regex-based symbol extraction:', error);
      return [];
    }
  }
  
  /**
   * Extracts symbols using AST-based parsing
   * (This is a more advanced approach that would require a proper parser)
   */
  private extractWithAst(
    filePath: string,
    chunk: { content: string; startLine: number; endLine: number; type?: string },
    _pattern: ExtractionPattern
  ): CodeSymbol[] {
    // This would use a proper AST parser like tree-sitter
    // For now, we'll just return an empty array as a placeholder
    console.log(`AST-based extraction not fully implemented for ${filePath}, chunk lines ${chunk.startLine}-${chunk.endLine}`);
    return [];
  }
  
  /**
   * Extracts symbols using semantic analysis
   * (This could involve more sophisticated analysis or using the LLM itself)
   */
  private extractWithSemantic(
    filePath: string,
    chunk: { content: string; startLine: number; endLine: number; type?: string },
    _pattern: ExtractionPattern
  ): CodeSymbol[] {
    // This would use more sophisticated analysis techniques
    // For now, we'll use a simple heuristic approach
    console.log(`Semantic extraction for ${filePath}, chunk lines ${chunk.startLine}-${chunk.endLine}`);
    
    const symbols: CodeSymbol[] = [];
    const content = chunk.content;
    
    // Default column positions
    const defaultStartColumn = 1;
    const defaultEndColumn = content.length > 0 ? content.length : 1;
    
    // Look for common patterns based on chunk type
    if (chunk.type) {
      switch (chunk.type.toLowerCase()) {
        case 'class':
        case 'interface':
          // Extract the class/interface name
          const classMatch = content.match(/(?:class|interface)\s+(\w+)/);
          if (classMatch && classMatch[1]) {
            symbols.push({
              name: classMatch[1] || 'UnnamedClass',
              type: chunk.type.toLowerCase() as any,
              location: {
                filePath,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                startColumn: defaultStartColumn,
                endColumn: defaultEndColumn
              },
              content
            });
            
            // Also look for methods within the class
            const methodRegex = /(?:public|private|protected|static|async)?\s*(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*(?:=>|{)/g;
            let methodMatch;
            while ((methodMatch = methodRegex.exec(content)) !== null) {
              const beforeMatchContent = content.substring(0, methodMatch.index || 0);
              const lineOffset = (beforeMatchContent.match(/\n/g) || []).length;
              
              // Get column information
              const lastNewlinePos = beforeMatchContent.lastIndexOf('\n');
              const startColumn = lastNewlinePos === -1 
                ? (methodMatch.index || 0) + 1 
                : (methodMatch.index || 0) - lastNewlinePos;
              
              const matchContent = methodMatch[0] || '';
              const endColumn = startColumn + (matchContent.length > 0 ? matchContent.length : 1);
              
              symbols.push({
                name: methodMatch[1] || 'unnamed',
                type: 'method' as any,
                location: {
                  filePath,
                  startLine: chunk.startLine + lineOffset,
                  endLine: chunk.startLine + lineOffset + 1, // Approximate
                  startColumn,
                  endColumn
                },
                parent: classMatch[1],
                content: methodMatch[0]
              });
            }
          }
          break;
          
        case 'function':
          // Extract function name
          const funcMatch = content.match(/function\s+(\w+)|(\w+)\s*=\s*function|\(\s*\)\s*=>\s*{/);
          if (funcMatch) {
            const name = funcMatch[1] || funcMatch[2] || 'anonymous';
            symbols.push({
              name,
              type: 'function' as any,
              location: {
                filePath,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                startColumn: defaultStartColumn,
                endColumn: defaultEndColumn
              },
              content
            });
          }
          break;
          
        case 'variable':
          // Extract variable name
          const varMatch = content.match(/(?:const|let|var)\s+(\w+)/);
          if (varMatch && varMatch[1]) {
            symbols.push({
              name: varMatch[1] || 'unnamed',
              type: 'variable' as any,
              location: {
                filePath,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                startColumn: defaultStartColumn,
                endColumn: defaultEndColumn
              },
              content
            });
          }
          break;
      }
    }
    
    return symbols;
  }
  
  /**
   * Generic approach for symbol extraction when no specific pattern type is matched
   */
  private extractWithGenericPattern(
    filePath: string,
    chunk: { content: string; startLine: number; endLine: number; type?: string },
    pattern: ExtractionPattern
  ): CodeSymbol[] {
    console.log(`Using generic pattern extraction for ${filePath}, chunk lines ${chunk.startLine}-${chunk.endLine}`);
    
    // Start with a basic extraction based on chunk type
    const symbols = this.extractByChunkType(filePath, chunk);
    
    // If pattern has specific definitions, try to use them
    if (pattern.definition && Object.keys(pattern.definition).length > 0) {
      // Use definition properties to guide extraction
      const definitionKeys = Object.keys(pattern.definition);
      
      if (definitionKeys.includes('namePattern')) {
        // Extract name using the provided pattern
        const namePattern = pattern.definition['namePattern'];
        try {
          const nameRegex = new RegExp(namePattern);
          const nameMatch = chunk.content.match(nameRegex);
          
          if (nameMatch && nameMatch[1] && symbols.length > 0 && symbols[0]) {
            // Update the first symbol's name
            symbols[0].name = nameMatch[1];
          }
        } catch (error) {
          console.error(`Invalid name pattern: ${namePattern}`, error);
        }
      }
    }
    
    return this.applyRefinements(symbols, pattern);
  }
  
  /**
   * Extracts symbols based on chunk type
   */
  private extractByChunkType(
    filePath: string,
    chunk: { content: string; startLine: number; endLine: number; type?: string }
  ): CodeSymbol[] {
    if (!chunk.type) {
      return [];
    }
    
    const content = chunk.content;
    const symbols: CodeSymbol[] = [];
    
    // Default column positions
    const defaultStartColumn = 1;
    const defaultEndColumn = content.length > 0 ? content.length : 1;
    
    // Common patterns for different chunk types
    switch (chunk.type.toLowerCase()) {
      case 'class':
        // Look for class declarations
        const classMatch = content.match(/class\s+(\w+)/);
        if (classMatch && classMatch[1]) {
          symbols.push({
            name: classMatch[1] || 'UnnamedClass',
            type: 'class',
            location: {
              filePath,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              startColumn: defaultStartColumn,
              endColumn: defaultEndColumn
            },
            content
          });
        }
        break;
        
      case 'function':
        // Look for function declarations
        const funcMatches = Array.from(content.matchAll(/function\s+(\w+)|export\s+(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g));
        
        for (const match of funcMatches) {
          const name = match[1] || match[2] || match[3] || 'anonymous';
          
          // Calculate location
          const beforeMatchContent = content.substring(0, match.index || 0);
          const lineOffset = (beforeMatchContent.match(/\n/g) || []).length;
          
          // Calculate column positions
          const lastNewlinePos = beforeMatchContent.lastIndexOf('\n');
          const startColumn = lastNewlinePos === -1 
            ? (match.index || 0) + 1 
            : (match.index || 0) - lastNewlinePos;
          
          const matchContent = match[0] || '';
          const endColumn = startColumn + (matchContent.length > 0 ? matchContent.length : 1);
          
          symbols.push({
            name,
            type: 'function',
            location: {
              filePath,
              startLine: chunk.startLine + lineOffset,
              endLine: chunk.endLine, // Approximation
              startColumn,
              endColumn
            },
            content: match[0]
          });
        }
        break;
        
      case 'interface':
        // Look for interface declarations
        const interfaceMatch = content.match(/interface\s+(\w+)/);
        if (interfaceMatch && interfaceMatch[1]) {
          symbols.push({
            name: interfaceMatch[1] || 'UnnamedInterface',
            type: 'interface',
            location: {
              filePath,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              startColumn: defaultStartColumn,
              endColumn: defaultEndColumn
            },
            content
          });
        }
        break;
        
      case 'variable':
        // Look for variable declarations
        const varMatches = Array.from(content.matchAll(/(?:const|let|var)\s+(\w+)/g));
        
        for (const match of varMatches) {
          // Calculate location
          const beforeMatchContent = content.substring(0, match.index || 0);
          const lineOffset = (beforeMatchContent.match(/\n/g) || []).length;
          
          // Calculate column positions
          const lastNewlinePos = beforeMatchContent.lastIndexOf('\n');
          const startColumn = lastNewlinePos === -1 
            ? (match.index || 0) + 1 
            : (match.index || 0) - lastNewlinePos;
          
          const matchContent = match[0] || '';
          const endColumn = startColumn + (matchContent.length > 0 ? matchContent.length : 1);
          
          symbols.push({
            name: match[1] || 'unnamed',
            type: 'variable',
            location: {
              filePath,
              startLine: chunk.startLine + lineOffset,
              endLine: chunk.startLine + lineOffset + 1, // Approximation
              startColumn,
              endColumn
            },
            content: match[0]
          });
        }
        break;
        
      case 'json-property':
        // Extract property from JSON
        const propMatch = content.match(/"(\w+)"\s*:/);
        if (propMatch && propMatch[1]) {
          symbols.push({
            name: propMatch[1] || 'unnamed',
            type: 'variable',
            location: {
              filePath,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              startColumn: defaultStartColumn,
              endColumn: defaultEndColumn
            },
            content
          });
        }
        break;
        
      default:
        // For unknown chunk types, try a more generic approach
        const genericMatches = [
          ...Array.from(content.matchAll(/class\s+(\w+)/g)),
          ...Array.from(content.matchAll(/function\s+(\w+)/g)),
          ...Array.from(content.matchAll(/interface\s+(\w+)/g)),
          ...Array.from(content.matchAll(/(?:const|let|var)\s+(\w+)/g))
        ];
        
        for (const match of genericMatches) {
          const beforeMatchContent = content.substring(0, match.index || 0);
          const lineOffset = (beforeMatchContent.match(/\n/g) || []).length;
          
          // Calculate column positions
          const lastNewlinePos = beforeMatchContent.lastIndexOf('\n');
          const startColumn = lastNewlinePos === -1 
            ? (match.index || 0) + 1 
            : (match.index || 0) - lastNewlinePos;
          
          const matchContent = match[0] || '';
          const endColumn = startColumn + (matchContent.length > 0 ? matchContent.length : 1);
          
          // Determine symbol type based on context
          let type: string;
          if (match[0].includes('class')) type = 'class';
          else if (match[0].includes('function')) type = 'function';
          else if (match[0].includes('interface')) type = 'interface';
          else type = 'variable';
          
          symbols.push({
            name: match[1] || 'unnamed',
            type: type as any,
            location: {
              filePath,
              startLine: chunk.startLine + lineOffset,
              endLine: chunk.startLine + lineOffset + 1, // Approximation
              startColumn,
              endColumn
            },
            content: match[0]
          });
        }
    }
    
    return symbols;
  }
  
  /**
   * Apply refinement rules to the extracted symbols
   */
  private applyRefinements(symbols: CodeSymbol[], pattern: ExtractionPattern): CodeSymbol[] {
    if (!pattern.refinement) {
      return symbols;
    }
    
    // Apply filtering based on refinement rules
    let refined = [...symbols];
    
    // Filter by name patterns
    if (pattern.refinement['excludeNamePatterns']) {
      const excludePatterns = pattern.refinement['excludeNamePatterns'] as string[];
      refined = refined.filter(symbol => {
        for (const patternStr of excludePatterns) {
          try {
            const regex = new RegExp(patternStr);
            if (regex.test(symbol.name)) {
              return false;
            }
          } catch (error) {
            console.error(`Invalid exclusion pattern: ${patternStr}`, error);
          }
        }
        return true;
      });
    }
    
    // Filter by type
    if (pattern.refinement['includeTypes']) {
      const includeTypes = pattern.refinement['includeTypes'] as string[];
      refined = refined.filter(symbol => includeTypes.includes(symbol.type));
    }
    
    // Filter by min/max content length
    if (pattern.refinement['minContentLength']) {
      const minLength = pattern.refinement['minContentLength'] as number;
      refined = refined.filter(symbol => (symbol.content?.length || 0) >= minLength);
    }
    
    if (pattern.refinement['maxContentLength']) {
      const maxLength = pattern.refinement['maxContentLength'] as number;
      refined = refined.filter(symbol => (symbol.content?.length || 0) <= maxLength);
    }
    
    return refined;
  }
  
  /**
   * Helper method to extract a name from a match when no capture groups are used
   */
  private extractNameFromMatch(matchText: string, pattern: ExtractionPattern): string {
    // Default extraction based on symbol type
    const targetType = pattern.targetSymbolTypes[0] || '';
    
    switch (targetType.toLowerCase()) {
      case 'function':
        const funcMatch = matchText.match(/function\s+(\w+)|(\w+)\s*=\s*function|(\w+)\s*\(/);
        return funcMatch ? (funcMatch[1] || funcMatch[2] || funcMatch[3] || 'anonymous') : 'anonymous';
        
      case 'class':
        const classMatch = matchText.match(/class\s+(\w+)/);
        return classMatch && classMatch[1] ? classMatch[1] : 'UnnamedClass';
        
      case 'interface':
        const interfaceMatch = matchText.match(/interface\s+(\w+)/);
        return interfaceMatch && interfaceMatch[1] ? interfaceMatch[1] : 'UnnamedInterface';
        
      case 'variable':
        const varMatch = matchText.match(/(?:const|let|var)\s+(\w+)/);
        return varMatch && varMatch[1] ? varMatch[1] : 'unnamed';
        
      default:
        // For unknown types, look for any word that might be a name
        const wordMatch = matchText.match(/(\w+)/);
        return wordMatch && wordMatch[1] ? wordMatch[1] : 'unnamed';
    }
  }
  
  /**
   * Normalizes a chunk type to a standard symbol type
   */
  private normalizeSymbolType(chunkType: string): string {
    const lowerType = chunkType.toLowerCase();
    
    // Direct mappings
    if (['function', 'class', 'interface', 'variable', 'import', 'export', 'type', 'method'].includes(lowerType)) {
      return lowerType;
    }
    
    // Indirect mappings
    switch (lowerType) {
      case 'method': return 'method';
      case 'func': return 'function';
      case 'fn': return 'function';
      case 'var': return 'variable';
      case 'const': return 'variable';
      case 'let': return 'variable';
      case 'typedef': return 'type';
      case 'property': return 'variable';
      case 'struct': return 'class';
      case 'enum': return 'type';
      default: return 'variable'; // Default to variable as a safe fallback
    }
  }
  
  /**
   * Generates a set of default extraction patterns for a given file type
   */
  generateDefaultPatterns(fileType: string): ExtractionPattern[] {
    const extension = fileType.startsWith('.') ? fileType : `.${fileType}`;
    
    // Common patterns for different file types
    switch (extension.toLowerCase()) {
      case '.ts':
      case '.tsx':
        return [
          // TypeScript class pattern
          {
            type: 'regex',
            targetSymbolTypes: ['class'],
            definition: {
              pattern: 'class\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?',
              flags: 'g',
              group2Name: 'extends'
            }
          },
          // TypeScript interface pattern
          {
            type: 'regex',
            targetSymbolTypes: ['interface'],
            definition: {
              pattern: 'interface\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?',
              flags: 'g',
              group2Name: 'extends'
            }
          },
          // TypeScript function pattern
          {
            type: 'regex',
            targetSymbolTypes: ['function'],
            definition: {
              pattern: '(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)\\s*\\(([^)]*)\\)',
              flags: 'g',
              group2Name: 'parameters'
            }
          },
          // TypeScript arrow function pattern
          {
            type: 'regex',
            targetSymbolTypes: ['function'],
            definition: {
              pattern: '(?:export\\s+)?(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:async\\s+)?\\(([^)]*)\\)\\s*=>',
              flags: 'g',
              group2Name: 'parameters'
            }
          },
          // TypeScript type definition
          {
            type: 'regex',
            targetSymbolTypes: ['type'],
            definition: {
              pattern: 'type\\s+(\\w+)\\s*=',
              flags: 'g'
            }
          }
        ];
        
      case '.js':
      case '.jsx':
        return [
          // JavaScript class pattern
          {
            type: 'regex',
            targetSymbolTypes: ['class'],
            definition: {
              pattern: 'class\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?',
              flags: 'g',
              group2Name: 'extends'
            }
          },
          // JavaScript function pattern
          {
            type: 'regex',
            targetSymbolTypes: ['function'],
            definition: {
              pattern: '(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)\\s*\\(([^)]*)\\)',
              flags: 'g',
              group2Name: 'parameters'
            }
          },
          // JavaScript arrow function pattern
          {
            type: 'regex',
            targetSymbolTypes: ['function'],
            definition: {
              pattern: '(?:export\\s+)?(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:async\\s+)?\\(([^)]*)\\)\\s*=>',
              flags: 'g',
              group2Name: 'parameters'
            }
          }
        ];
        
      case '.json':
        return [
          // JSON property pattern
          {
            type: 'regex',
            targetSymbolTypes: ['variable'],
            definition: {
              pattern: '"(\\w+)"\\s*:',
              flags: 'g'
            }
          }
        ];
        
      case '.md':
        return [
          // Markdown heading pattern
          {
            type: 'regex',
            targetSymbolTypes: ['variable'],
            definition: {
              pattern: '^(#{1,6})\\s+(.+)$',
              flags: 'gm',
              group1Name: 'level',
              group2Name: 'title'
            }
          }
        ];
        
      default:
        // Generic patterns for any file type
        return [
          {
            type: 'regex',
            targetSymbolTypes: ['function', 'class', 'variable'],
            definition: {
              pattern: '(?:function|class)\\s+(\\w+)|(?:const|let|var)\\s+(\\w+)',
              flags: 'g'
            }
          }
        ];
    }
  }
}