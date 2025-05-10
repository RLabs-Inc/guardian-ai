// source/services/indexing/treeSitter.ts
import Parser from 'tree-sitter';
// import fs from 'fs-extra';
// import path from 'path';

/**
 * Manages Tree-sitter initialization and language loading
 */
export class TreeSitterManager {
  private static instance: TreeSitterManager;
  private parser: Parser;
  private languages: Map<string, any> = new Map();
  private initialized = false;
  
  private constructor() {
    this.parser = new Parser();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): TreeSitterManager {
    if (!TreeSitterManager.instance) {
      TreeSitterManager.instance = new TreeSitterManager();
    }
    return TreeSitterManager.instance;
  }
  
  /**
   * Initialize Tree-sitter and load language parsers
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Load JavaScript parser
      const JavaScript = await this.loadLanguage('javascript');
      this.languages.set('.js', JavaScript);
      this.languages.set('.jsx', JavaScript);
      
      // Load TypeScript parser
      const TypeScript = await this.loadLanguage('typescript');
      this.languages.set('.ts', TypeScript.typescript);
      this.languages.set('.tsx', TypeScript.tsx);
      
      // Load Python parser
      const Python = await this.loadLanguage('python');
      this.languages.set('.py', Python);
      
      // Add more languages as needed
      
      this.initialized = true;
      console.log('Tree-sitter initialized with language parsers');
    } catch (error) {
      console.error('Failed to initialize Tree-sitter:', error);
      throw error;
    }
  }
  
  /**
   * Get a Tree-sitter parser for a specific file extension
   */
  public getParserForExtension(extension: string): Parser | null {
    if (!this.initialized) {
      throw new Error('Tree-sitter not initialized');
    }
    
    const language = this.languages.get(extension.toLowerCase());
    if (!language) {
      return null; // No parser available for this extension
    }
    
    this.parser.setLanguage(language);
    return this.parser;
  }
  
  /**
   * Load a language parser
   */
  private async loadLanguage(language: string): Promise<any> {
    try {
      return await import(`tree-sitter-${language}`);
    } catch (error) {
      console.error(`Failed to load language parser for ${language}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a query for a specific language
   */
  public createQuery(language: string, queryString: string): Parser.Query | null {
    const parser = this.getParserForExtension(language);
    if (!parser) {
      return null;
    }
    
    try {
      const language = parser.getLanguage();
      // Create a custom query (Tree-sitter's typing doesn't include query but it's there)
      // @ts-ignore - The Language object does have a query method at runtime
      return language.query(queryString);
    } catch (error) {
      console.error(`Failed to create query:`, error);
      return null;
    }
  }
  
  /**
   * Parse content with the appropriate language parser
   */
  public parse(content: string, extension: string): Parser.Tree | null {
    const parser = this.getParserForExtension(extension);
    if (!parser) {
      return null;
    }
    
    try {
      return parser.parse(content);
    } catch (error) {
      console.error(`Failed to parse content with ${extension} parser:`, error);
      return null;
    }
  }
  
  /**
   * Check if a language parser is available for a given extension
   */
  public supportsExtension(extension: string): boolean {
    return this.languages.has(extension.toLowerCase());
  }
  
  /**
   * Get list of supported extensions
   */
  public getSupportedExtensions(): string[] {
    return Array.from(this.languages.keys());
  }
}