// source/services/indexing/parsers/parserFactory.ts
import { CodeParser } from './baseParser.js';
import { JavaScriptParser } from './javascriptParser.js';

/**
 * Factory class to get the appropriate parser for a given file
 */
export class ParserFactory {
  private static instance: ParserFactory;
  private parsers: CodeParser[] = [];
  private initialized = false;
  
  private constructor() {
    // Register parsers
    this.parsers.push(new JavaScriptParser());
    // Add more parsers as they are implemented
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ParserFactory {
    if (!ParserFactory.instance) {
      ParserFactory.instance = new ParserFactory();
    }
    return ParserFactory.instance;
  }
  
  /**
   * Initialize all parsers
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize all parsers
    for (const parser of this.parsers) {
      await parser.initialize();
    }
    
    this.initialized = true;
  }
  
  /**
   * Get a parser for a specific file extension
   */
  public getParserForExtension(extension: string): CodeParser | null {
    if (!this.initialized) {
      throw new Error('Parser factory not initialized');
    }
    
    for (const parser of this.parsers) {
      if (parser.supportsExtension(extension)) {
        return parser;
      }
    }
    
    return null;
  }
  
  /**
   * Get all supported file extensions
   */
  public getSupportedExtensions(): string[] {
    const extensions: string[] = [];
    
    for (const parser of this.parsers) {
      extensions.push(...parser.getSupportedExtensions());
    }
    
    return extensions;
  }
}