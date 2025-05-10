// source/services/indexing/llmDirected/patternInterpreter.ts

import { ChunkingPattern } from './agentProtocol.js';
import { StoragePrimitives } from './storagePrimitives.js';

/**
 * Interface for a file chunk
 */
export interface FileChunk {
  content: string;
  startLine: number;
  endLine: number;
  type?: string;
  description?: string;
}

/**
 * The PatternInterpreter class interprets and executes arbitrary chunking patterns
 * defined by the LLM, enabling a flexible and adaptable chunking system.
 */
export class PatternInterpreter {
  private storagePrimitives: StoragePrimitives;
  
  constructor(storagePrimitives: StoragePrimitives) {
    this.storagePrimitives = storagePrimitives;
  }
  
  /**
   * Executes a chunking pattern on file content
   * @param filePath The path to the file
   * @param content The file content
   * @param pattern The chunking pattern to execute
   * @returns An array of chunks
   */
  async executeChunkingPattern(
    filePath: string,
    content: string,
    pattern: ChunkingPattern
  ): Promise<FileChunk[]> {
    try {
      console.log(`Executing chunking pattern of type: ${pattern.type}`);
      
      // Interpret the pattern type
      switch (pattern.type.toLowerCase()) {
        case 'regex':
          return this.executeRegexPattern(content, pattern);
        case 'delimiter':
          return this.executeDelimiterPattern(content, pattern);
        case 'block':
          return this.executeBlockPattern(content, pattern);
        case 'semantic':
        case 'semantic-sections':
        case 'section-based':
          return this.executeSemanticPattern(content, pattern);
        case 'fixed-size':
        case 'line-based':
          return this.executeFixedSizePattern(filePath, content, pattern);
        case 'hierarchy':
          return this.executeHierarchyPattern(content, pattern);
        case 'markup':
        case 'markdown':
          return this.executeMarkupPattern(content, pattern);
        case 'json':
        case 'structured':
          return this.executeStructuredPattern(content, pattern);
        default:
          // For any unknown pattern type, use a generic approach
          return this.interpretGenericPattern(content, pattern);
      }
    } catch (error) {
      console.error(`Error executing chunking pattern: ${pattern.type}`, error);
      // Fall back to line-based chunking
      return await this.storagePrimitives.chunkByLineCount(filePath, 100);
    }
  }
  
  /**
   * Executes a regex-based chunking pattern
   */
  private executeRegexPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Executing regex pattern: ${JSON.stringify(pattern.definition)}`);
    const chunks: FileChunk[] = [];
    
    try {
      // Get the pattern definition
      const patternStr = pattern.definition['pattern'] || pattern.definition['regex'];
      const flags = pattern.definition['flags'] || '';
      const matchType = pattern.definition['matchType'] || 'all';
      
      if (!patternStr) {
        console.error('No regex pattern defined');
        return this.fallbackLineChunking(content);
      }
      
      // Create the regex
      const regex = new RegExp(patternStr, flags);

      // Line number tracking is done in getLineNumber method

      // Apply the regex based on match type
      if (matchType === 'all') {
        // Match entire content against the regex
        const match = content.match(regex);
        if (match && match[0]) {
          // Calculate line numbers
          const startIndex = match.index || 0;
          const endIndex = startIndex + match[0].length;
          
          const startLine = this.getLineNumber(content, startIndex);
          const endLine = this.getLineNumber(content, endIndex);
          
          chunks.push({
            content: match[0],
            startLine,
            endLine,
            type: pattern.definition['type'] || 'regex'
          });
        }
      } else {
        // Match all occurrences
        let match;
        // Unused variable, kept for future implementation
        
        // Use exec with a loop to find all matches
        while ((match = regex.exec(content)) !== null) {
          const startIndex = match.index;
          const endIndex = startIndex + match[0].length;
          
          const startLine = this.getLineNumber(content, startIndex);
          const endLine = this.getLineNumber(content, endIndex);
          
          chunks.push({
            content: match[0],
            startLine,
            endLine,
            type: pattern.definition['type'] || 'regex'
          });
          
          // If the regex is global, continue, otherwise break
          if (!regex.global) break;
        }
      }
      
      // Apply post-processing rules if specified
      if (pattern.applicationRules['minimumSize'] && chunks.length > 0) {
        const minSize = pattern.applicationRules['minimumSize'];
        return chunks.filter(chunk => chunk.content.length >= minSize);
      }
      
      return chunks.length > 0 ? chunks : this.fallbackLineChunking(content);
    } catch (error) {
      console.error('Error executing regex pattern:', error);
      return this.fallbackLineChunking(content);
    }
  }
  
  /**
   * Executes a delimiter-based chunking pattern
   */
  private executeDelimiterPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Executing delimiter pattern: ${JSON.stringify(pattern.definition)}`);
    const chunks: FileChunk[] = [];
    
    try {
      // Get the delimiters
      const startDelimiter = pattern.definition['start'];
      const endDelimiter = pattern.definition['end'];
      
      if (!startDelimiter || !endDelimiter) {
        console.error('Start or end delimiter not defined');
        return this.fallbackLineChunking(content);
      }
      
      // Line number tracking is done in getLineNumber method
      
      // Find all occurrences of the start delimiter
      let searchStartIndex = 0;
      while (searchStartIndex < content.length) {
        const startIndex = content.indexOf(startDelimiter, searchStartIndex);
        if (startIndex === -1) break;
        
        // Find the matching end delimiter
        const endIndex = content.indexOf(endDelimiter, startIndex + startDelimiter.length);
        if (endIndex === -1) break;
        
        // Calculate line numbers
        const startLine = this.getLineNumber(content, startIndex);
        const endLine = this.getLineNumber(content, endIndex + endDelimiter.length);
        
        // Extract the chunk
        const chunkContent = content.substring(startIndex, endIndex + endDelimiter.length);
        
        chunks.push({
          content: chunkContent,
          startLine,
          endLine,
          type: pattern.definition['type'] || 'delimiter'
        });
        
        // Move to the end of this chunk
        searchStartIndex = endIndex + endDelimiter.length;
      }
      
      return chunks.length > 0 ? chunks : this.fallbackLineChunking(content);
    } catch (error) {
      console.error('Error executing delimiter pattern:', error);
      return this.fallbackLineChunking(content);
    }
  }
  
  /**
   * Executes a block-based chunking pattern (for code blocks, functions, etc.)
   */
  private executeBlockPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Executing block pattern: ${JSON.stringify(pattern.definition)}`);
    const chunks: FileChunk[] = [];
    
    try {
      // Get block patterns
      const blockStart = pattern.definition['blockStart'] || pattern.definition['start'];
      const blockEnd = pattern.definition['blockEnd'] || pattern.definition['end'];
      
      if (!blockStart) {
        console.error('Block start pattern not defined');
        return this.fallbackLineChunking(content);
      }
      
      // Create regex for finding blocks
      const blockRegex = blockEnd 
        ? new RegExp(`${blockStart}[\\s\\S]*?${blockEnd}`, 'g')
        : new RegExp(`${blockStart}[\\s\\S]*?$`, 'g');
      
      // Find all blocks
      let match;
      while ((match = blockRegex.exec(content)) !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        
        const startLine = this.getLineNumber(content, startIndex);
        const endLine = this.getLineNumber(content, endIndex);
        
        chunks.push({
          content: match[0],
          startLine,
          endLine,
          type: pattern.definition['type'] || 'block'
        });
      }
      
      return chunks.length > 0 ? chunks : this.fallbackLineChunking(content);
    } catch (error) {
      console.error('Error executing block pattern:', error);
      return this.fallbackLineChunking(content);
    }
  }
  
  /**
   * Executes a semantic-based chunking pattern (for markdown sections, etc.)
   */
  private executeSemanticPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Executing semantic pattern: ${JSON.stringify(pattern.definition)}`);
    const chunks: FileChunk[] = [];
    
    try {
      // Determine the type of semantic boundaries
      const boundaryType = pattern.definition['boundaryType'] || 'heading';
      
      if (boundaryType === 'heading' || boundaryType === 'section') {
        // Get heading level for markdown
        const headingLevel = pattern.definition['headingLevel'] || [1, 2]; // Default to h1 and h2
        
        // Define regex for different heading levels
        const headingRegexes = Array.isArray(headingLevel) 
          ? headingLevel.map(level => new RegExp(`^#{${level}}\\s+(.+)$`, 'gm'))
          : [new RegExp(`^#{${headingLevel}}\\s+(.+)$`, 'gm')];
        
        // Find all headings at the specified levels
        const headings: {level: number, text: string, index: number, line: number}[] = [];
        
        headingRegexes.forEach((regex, i) => {
          let match;
          while ((match = regex.exec(content)) !== null) {
            headings.push({
              level: Array.isArray(headingLevel) ? headingLevel[i] : headingLevel,
              text: match[1] || '',
              index: match.index,
              line: this.getLineNumber(content, match.index)
            });
          }
        });
        
        // Sort headings by their position in the document
        headings.sort((a, b) => a.index - b.index);
        
        // Create chunks between headings
        for (let i = 0; i < headings.length; i++) {
          const currentHeading = headings[i];
          const nextHeading = headings[i + 1];
          
          const startIndex = currentHeading?.index || 0;
          const endIndex = nextHeading ? nextHeading.index : content.length;
          
          const startLine = currentHeading?.line || 0;
          const endLine = nextHeading ? nextHeading.line - 1 : this.getLineNumber(content, content.length);
          
          const sectionContent = content.substring(startIndex, endIndex);
          
          chunks.push({
            content: sectionContent,
            startLine,
            endLine,
            type: 'section',
            description: currentHeading?.text || ''
          });
        }
      }
      
      return chunks.length > 0 ? chunks : this.fallbackLineChunking(content);
    } catch (error) {
      console.error('Error executing semantic pattern:', error);
      return this.fallbackLineChunking(content);
    }
  }
  
  /**
   * Executes a fixed-size chunking pattern (line-based)
   */
  private async executeFixedSizePattern(filePath: string, _content: string, pattern: ChunkingPattern): Promise<FileChunk[]> {
    console.log(`Executing fixed-size pattern: ${JSON.stringify(pattern.definition)}`);
    
    try {
      // Get chunk size
      const chunkSize = pattern.definition['lineCount'] ||
                      pattern.definition['chunkSize'] ||
                      pattern.definition['size'] ||
                      100;
                      
      // Get overlap size
      const overlapSize = pattern.applicationRules['overlap'] ||
                         pattern.applicationRules['overlapSize'] ||
                         0;
      
      // Use storage primitives to create line-based chunks
      return await this.storagePrimitives.chunkByLineCount(filePath, chunkSize, overlapSize);
    } catch (error) {
      console.error('Error executing fixed-size pattern:', error);
      return await this.storagePrimitives.chunkByLineCount(filePath, 100);
    }
  }
  
  /**
   * Executes a hierarchy-based chunking pattern
   */
  private executeHierarchyPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Executing hierarchy pattern: ${JSON.stringify(pattern.definition)}`);
    const chunks: FileChunk[] = [];
    
    // This is a more complex pattern that can be implemented based on specific needs
    // For now, we'll implement a basic version that looks for hierarchical structures
    
    try {
      // Define patterns for hierarchical structures (e.g., nested blocks)
      const hierarchyLevels = pattern.definition['levels'] || [];
      
      if (hierarchyLevels.length === 0) {
        console.error('No hierarchy levels defined');
        return this.fallbackLineChunking(content);
      }
      
      // Process each level of the hierarchy
      for (const level of hierarchyLevels) {
        const startPattern = level['startPattern'] || level['start'];
        const endPattern = level['endPattern'] || level['end'];
        
        if (!startPattern || !endPattern) continue;
        
        // Create regex for this level
        const levelRegex = new RegExp(`${startPattern}[\\s\\S]*?${endPattern}`, 'g');
        
        // Find all matches at this level
        let match;
        while ((match = levelRegex.exec(content)) !== null) {
          const startIndex = match.index;
          const endIndex = startIndex + match[0].length;
          
          const startLine = this.getLineNumber(content, startIndex);
          const endLine = this.getLineNumber(content, endIndex);
          
          chunks.push({
            content: match[0],
            startLine,
            endLine,
            type: level['type'] || 'hierarchy',
            description: level['description'] || `Level ${level['level'] || 'unknown'}`
          });
        }
      }
      
      return chunks.length > 0 ? chunks : this.fallbackLineChunking(content);
    } catch (error) {
      console.error('Error executing hierarchy pattern:', error);
      return this.fallbackLineChunking(content);
    }
  }
  
  /**
   * Executes a markup-based chunking pattern (for HTML, XML, Markdown, etc.)
   */
  private executeMarkupPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Executing markup pattern: ${JSON.stringify(pattern.definition)}`);
    const chunks: FileChunk[] = [];
    
    try {
      // Get the markup type
      const markupType = pattern.definition['markupType'] || 'markdown';
      
      if (markupType === 'markdown') {
        // Handle Markdown specific patterns
        return this.executeSemanticPattern(content, {
          ...pattern,
          definition: {
            ...pattern.definition,
            boundaryType: 'heading'
          }
        });
      } else if (markupType === 'html' || markupType === 'xml') {
        // Handle HTML/XML patterns using tag matching
        const tagPatterns = pattern.definition['tags'] || ['div', 'section', 'article'];
        
        for (const tag of tagPatterns) {
          const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
          
          let match;
          while ((match = tagRegex.exec(content)) !== null) {
            const startIndex = match.index;
            const endIndex = startIndex + match[0].length;
            
            const startLine = this.getLineNumber(content, startIndex);
            const endLine = this.getLineNumber(content, endIndex);
            
            chunks.push({
              content: match[0],
              startLine,
              endLine,
              type: 'markup',
              description: `${tag} element`
            });
          }
        }
      }
      
      return chunks.length > 0 ? chunks : this.fallbackLineChunking(content);
    } catch (error) {
      console.error('Error executing markup pattern:', error);
      return this.fallbackLineChunking(content);
    }
  }
  
  /**
   * Executes a pattern for structured data formats (JSON, YAML, etc.)
   */
  private executeStructuredPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Executing structured pattern: ${JSON.stringify(pattern.definition)}`);
    // Initial chunks array not used as each format handler returns its own chunks

    try {
      // Get the structured data format
      const format = pattern.definition['format'] || 'json';

      // Check if we should treat the entire file as one chunk
      const wholeFile = pattern.definition['wholeFile'] ||
                       pattern.definition['includeEntireFile'] ||
                       pattern.applicationRules['treatAsWholeFile'];

      if (wholeFile) {
        console.log('Using whole file pattern for structured data');
        return [{
          content: content,
          startLine: 1,
          endLine: content.split('\n').length,
          type: 'whole-file',
          description: `Complete ${format} file`
        }];
      }

      if (format === 'json') {
        // Try to parse the content as JSON
        try {
          const jsonContent = JSON.parse(content);

          // Get the path to the elements to chunk
          const chunkPath = pattern.definition['path'] || '';

          // Navigate to the specified path
          let target = jsonContent;
          if (chunkPath) {
            const pathParts = chunkPath.split('.');
            for (const part of pathParts) {
              target = target[part];
              if (!target) break;
            }
          }

          // If no specific path or invalid path, treat the whole file as a chunk
          if (!target) {
            console.log('No valid path found in JSON, treating as whole file');
            return [{
              content: content,
              startLine: 1,
              endLine: content.split('\n').length,
              type: 'json-whole',
              description: 'Complete JSON file'
            }];
          }

          // Handle different types of JSON structures
          if (Array.isArray(target)) {
            // Handle arrays
            return this.chunkJsonArray(content, target, chunkPath);
          } else if (typeof target === 'object' && target !== null) {
            // Handle objects
            return this.chunkJsonObject(content, target);
          } else {
            // For primitives, use the whole file
            return [{
              content: content,
              startLine: 1,
              endLine: content.split('\n').length,
              type: 'json-primitive',
              description: 'JSON with primitive value'
            }];
          }
        } catch (error) {
          console.error('Error parsing JSON:', error);
          // For invalid JSON, treat as whole file
          return [{
            content: content,
            startLine: 1,
            endLine: content.split('\n').length,
            type: 'json-invalid',
            description: 'Invalid JSON file'
          }];
        }
      } else if (format === 'yaml' || format === 'yml') {
        // For YAML files, use document separators as chunk boundaries
        const yamlDocSeparator = /^---\s*$/m;
        const lines = content.split('\n');
        let startLine = 1;
        let currentDoc = [];
        const documents = [];

        // Find YAML document separators
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line && yamlDocSeparator.test(line) && currentDoc.length > 0) {
            // End of a document
            documents.push({
              content: currentDoc.join('\n'),
              startLine: startLine,
              endLine: i,
              type: 'yaml-document',
              description: `YAML Document ${documents.length + 1}`
            });

            startLine = i + 1;
            currentDoc = [];
          } else {
            currentDoc.push(line);
          }
        }

        // Add the last document if there is one
        if (currentDoc.length > 0) {
          documents.push({
            content: currentDoc.join('\n'),
            startLine: startLine,
            endLine: lines.length,
            type: 'yaml-document',
            description: `YAML Document ${documents.length + 1}`
          });
        }

        if (documents.length > 0) {
          return documents;
        }

        // If no documents found, treat as whole file
        return [{
          content: content,
          startLine: 1,
          endLine: lines.length,
          type: 'yaml-whole',
          description: 'Complete YAML file'
        }];
      }

      // For other structured data formats, fall back to line-based chunking
      return this.fallbackLineChunking(content);
    } catch (error) {
      console.error('Error executing structured pattern:', error);
      return this.fallbackLineChunking(content);
    }
  }

  /**
   * Helper method to chunk a JSON array into separate chunks
   */
  private chunkJsonArray(content: string, array: any[], chunkPath: string): FileChunk[] {
    const chunks: FileChunk[] = [];
    const lines = content.split('\n');

    // Find the array in the content
    let arrayStart = 0;
    let arrayEnd = lines.length;

    // Try to locate the array in the content
    const pathPattern = chunkPath ?
                       new RegExp(`"${chunkPath}"\\s*:\\s*\\[`) :
                       /\[\s*$/;

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i] || '';
      if (pathPattern.test(currentLine)) {
        arrayStart = i;
        break;
      }
    }

    // Chunk each array element
    for (let i = 0; i < array.length; i++) {
      const element = array[i];
      const elementStr = JSON.stringify(element, null, 2);
      const elementLines = elementStr.split('\n').length;

      // Calculate approximate line numbers
      const estStartLine = arrayStart + 1 + (i * elementLines);
      const estEndLine = estStartLine + elementLines - 1;

      chunks.push({
        content: elementStr,
        startLine: estStartLine, // Approximate
        endLine: Math.min(estEndLine, arrayEnd), // Approximate
        type: 'json-array-element',
        description: `Array element ${i}${element.name ? `: ${element.name}` : ''}`
      });
    }

    // If we couldn't chunk the array properly, use the whole array
    if (chunks.length === 0) {
      chunks.push({
        content: JSON.stringify(array, null, 2),
        startLine: arrayStart + 1,
        endLine: arrayEnd,
        type: 'json-array',
        description: `Complete JSON array${chunkPath ? ` at ${chunkPath}` : ''}`
      });
    }

    return chunks;
  }

  /**
   * Helper method to chunk a JSON object into separate chunks by properties
   */
  private chunkJsonObject(content: string, obj: Record<string, any>): FileChunk[] {
    const chunks: FileChunk[] = [];
    const lines = content.split('\n');

    // Get top-level properties
    const properties = Object.keys(obj);

    if (properties.length === 0) {
      // Empty object
      return [{
        content: '{}',
        startLine: 1,
        endLine: lines.length,
        type: 'json-empty-object',
        description: 'Empty JSON object'
      }];
    }

    // If too many properties, group them into logical chunks
    if (properties.length > 10) {
      // Just use the whole object
      return [{
        content: content,
        startLine: 1,
        endLine: lines.length,
        type: 'json-complex-object',
        description: 'Complex JSON object'
      }];
    }

    // Try to find each property in the file
    for (const prop of properties) {
      // Try to find the property in the content
      const propPattern = new RegExp(`"${prop}"\\s*:`);
      let propStart = -1;
      let propEnd = -1;

      for (let i = 0; i < lines.length; i++) {
        const lineContent = lines[i] || '';
        if (propPattern.test(lineContent)) {
          propStart = i;

          // Find the end of this property
          for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j];
            // Property ends at comma or closing brace
            const lineContent = line || '';
            if (/,\s*$/.test(lineContent) || /}/.test(lineContent)) {
              propEnd = j;
              break;
            }
          }

          if (propEnd !== -1) {
            break;
          }
        }
      }

      // If we found the property in the file
      if (propStart !== -1 && propEnd !== -1) {
        const propContent = lines.slice(propStart, propEnd + 1).join('\n');
        chunks.push({
          content: propContent,
          startLine: propStart + 1,
          endLine: propEnd + 1,
          type: 'json-property',
          description: `Property: ${prop}`
        });
      } else {
        // Couldn't find property in the file, use its value
        const propValue = obj[prop];
        const propContent = `"${prop}": ${JSON.stringify(propValue, null, 2)}`;

        // Add to chunks with approximate line numbers
        chunks.push({
          content: propContent,
          startLine: 1, // Approximate
          endLine: 1 + propContent.split('\n').length - 1, // Approximate
          type: 'json-property',
          description: `Property: ${prop}`
        });
      }
    }

    return chunks;
  }
  
  /**
   * Interprets and executes a generic pattern
   */
  private interpretGenericPattern(content: string, pattern: ChunkingPattern): FileChunk[] {
    console.log(`Interpreting generic pattern: ${JSON.stringify(pattern)}`);
    
    // Try to determine the most appropriate specific pattern type
    if (pattern.definition['regex'] || pattern.definition['pattern']) {
      return this.executeRegexPattern(content, pattern);
    } else if (pattern.definition['start'] && pattern.definition['end']) {
      return this.executeDelimiterPattern(content, pattern);
    } else if (pattern.definition['blockStart'] || pattern.definition['blockEnd']) {
      return this.executeBlockPattern(content, pattern);
    } else if (pattern.definition['headingLevel'] || pattern.definition['sections']) {
      return this.executeSemanticPattern(content, pattern);
    } else if (pattern.definition['tags'] || pattern.definition['markupType']) {
      return this.executeMarkupPattern(content, pattern);
    } else {
      // If we can't determine a specific pattern type, fall back to line-based chunking
      return this.fallbackLineChunking(content);
    }
  }
  
  /**
   * Calculate the line number for a given index in the content
   */
  private getLineNumber(content: string, index: number): number {
    // Count newlines up to the index
    const precedingContent = content.substring(0, index);
    const newlines = precedingContent.match(/\n/g);
    return (newlines ? newlines.length : 0) + 1; // Line numbers are 1-based
  }
  
  /**
   * Fall back to simple line-based chunking
   */
  private fallbackLineChunking(content: string): FileChunk[] {
    console.log('Using fallback line-based chunking');
    const lines = content.split('\n');
    const chunkSize = 100;
    const chunks: FileChunk[] = [];
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkLines = lines.slice(i, i + chunkSize);
      chunks.push({
        content: chunkLines.join('\n'),
        startLine: i + 1, // Line numbers are 1-based
        endLine: Math.min(i + chunkSize, lines.length),
        type: 'line-based'
      });
    }
    
    return chunks;
  }
}