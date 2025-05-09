// source/services/indexing/parsers/baseParser.ts
import { CodeSymbol, CodeDependency } from '../types.js';

/**
 * Interface for language-specific parsers
 */
export interface CodeParser {
  /**
   * Get the file extensions this parser supports
   */
  getSupportedExtensions(): string[];
  
  /**
   * Initialize the parser
   */
  initialize(): Promise<void>;
  
  /**
   * Parse a file and extract symbols
   * @param filePath The path to the file
   * @param content The content of the file
   * @param extension The file extension
   */
  parseFile(filePath: string, content: string, extension: string): Promise<CodeSymbol[]>;
  
  /**
   * Extract dependencies from a file
   * @param filePath The path to the file
   * @param content The content of the file
   * @param extension The file extension
   */
  extractDependencies(filePath: string, content: string, extension: string): Promise<CodeDependency[]>;
  
  /**
   * Check if this parser supports a given file extension
   * @param extension The file extension to check
   */
  supportsExtension(extension: string): boolean;
}

/**
 * Base implementation for language-specific parsers
 */
export abstract class BaseParser implements CodeParser {
  private supportedExtensions: string[] = [];
  
  constructor(supportedExtensions: string[]) {
    this.supportedExtensions = supportedExtensions;
  }
  
  getSupportedExtensions(): string[] {
    return this.supportedExtensions;
  }
  
  async initialize(): Promise<void> {
    // Default implementation does nothing
  }
  
  abstract parseFile(filePath: string, content: string, extension: string): Promise<CodeSymbol[]>;
  
  abstract extractDependencies(filePath: string, content: string, extension: string): Promise<CodeDependency[]>;
  
  supportsExtension(extension: string): boolean {
    return this.supportedExtensions.includes(extension.toLowerCase());
  }
  
  /**
   * Helper to find the line index for a character position
   */
  protected findLineIndex(content: string, position: number): number {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
  }
  
  /**
   * Helper to extract a range of lines from content
   */
  protected extractLines(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }
}