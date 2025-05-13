/**
 * AST Parser for extracting structured information from source code
 * 
 * Uses Tree-sitter to generate and traverse Abstract Syntax Trees
 */

import path from 'path';
// Note: Using any type for Parser since exact types aren't available
const Parser: any = require('tree-sitter');
import fs from 'fs';

// Define the symbol interface that will be used internally
interface Symbol {
  name: string;
  type: string;
  content: string;
  location: {
    start: { line: number; column: number; };
    end: { line: number; column: number; };
  };
  metadata: Record<string, any>;
  children?: Symbol[];
}

export class AstParser {
  private parser: any; // Tree-sitter parser
  private languageParsers: Map<string, any>; // Map of file extensions to language parsers
  private initialized: boolean;
  
  constructor() {
    this.parser = new Parser();
    this.languageParsers = new Map();
    this.initialized = false;
  }
  
  /**
   * Initialize the parser with language grammars
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Load WASM and language parsers
      const wasmPath = path.resolve('./public/tree-sitter.wasm');
      const wasmModule = await fs.promises.readFile(wasmPath);
      await Parser.init({ wasmModule });
      
      // Load language-specific parsers
      await this.loadLanguageParsers();
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing AST parser:', error);
      throw error;
    }
  }
  
  /**
   * Load language-specific parsers
   */
  private async loadLanguageParsers(): Promise<void> {
    const languageDir = path.resolve('./public/tree-sitter-wasm');
    
    try {
      // Map of file extensions to WASM language modules
      const languageModules = [
        { extensions: ['.js', '.jsx'], module: 'tree-sitter-javascript.wasm' },
        { extensions: ['.ts', '.tsx'], module: 'tree-sitter-typescript.wasm' },
        { extensions: ['.py'], module: 'tree-sitter-python.wasm' },
        { extensions: ['.java'], module: 'tree-sitter-java.wasm' },
        { extensions: ['.rb'], module: 'tree-sitter-ruby.wasm' },
        { extensions: ['.c', '.cpp', '.h', '.hpp'], module: 'tree-sitter-c.wasm' },
        { extensions: ['.go'], module: 'tree-sitter-go.wasm' },
        { extensions: ['.rs'], module: 'tree-sitter-rust.wasm' },
        { extensions: ['.php'], module: 'tree-sitter-php.wasm' }
      ];
      
      // Load each language parser
      for (const { extensions, module } of languageModules) {
        try {
          const modulePath = path.join(languageDir, module);
          if (fs.existsSync(modulePath)) {
            const language = await Parser.Language.load(modulePath);
            
            // Add each extension to the map
            for (const ext of extensions) {
              this.languageParsers.set(ext, language);
            }
          }
        } catch (error) {
          console.warn(`Error loading language module ${module}:`, error);
        }
      }
      
      console.log(`Loaded ${this.languageParsers.size} language parsers`);
    } catch (error) {
      console.error('Error loading language parsers:', error);
      throw error;
    }
  }
  
  /**
   * Check if a file type is supported
   * @param extension File extension (e.g., '.js', '.ts')
   */
  isSupportedFileType(extension: string): boolean {
    return this.languageParsers.has(extension);
  }
  
  /**
   * Parse a file into an AST
   * @param filePath Path to the file
   * @param content File content
   */
  async parseFile(filePath: string, content: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const extension = path.extname(filePath).toLowerCase();
    const language = this.languageParsers.get(extension);
    
    if (!language) {
      throw new Error(`Unsupported file type: ${extension}`);
    }
    
    try {
      this.parser.setLanguage(language);
      return this.parser.parse(content);
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract symbols from an AST
   * @param ast Abstract Syntax Tree
   * @param filePath Path to the source file
   */
  async extractSymbols(ast: any, filePath: string): Promise<Symbol[]> {
    const extension = path.extname(filePath).toLowerCase();
    const symbols: Symbol[] = [];
    
    try {
      // Get the appropriate extractor based on file type
      const extractor = this.getSymbolExtractor(extension);
      if (!extractor) {
        return symbols;
      }
      
      // Extract symbols using the language-specific extractor
      await extractor(ast, symbols, filePath);
      
      return symbols;
    } catch (error) {
      console.error(`Error extracting symbols from ${filePath}:`, error);
      return symbols;
    }
  }
  
  /**
   * Get a symbol extractor for a specific file type
   * @param extension File extension
   */
  private getSymbolExtractor(extension: string): ((ast: any, symbols: Symbol[], filePath: string) => Promise<void>) | null {
    // Map of file extensions to symbol extractor functions
    const extractors: Record<string, (ast: any, symbols: Symbol[], filePath: string) => Promise<void>> = {
      '.js': this.extractJavaScriptSymbols.bind(this),
      '.jsx': this.extractJavaScriptSymbols.bind(this),
      '.ts': this.extractTypeScriptSymbols.bind(this),
      '.tsx': this.extractTypeScriptSymbols.bind(this),
      '.py': this.extractPythonSymbols.bind(this),
      '.java': this.extractJavaSymbols.bind(this),
      '.rb': this.extractRubySymbols.bind(this),
      '.cpp': this.extractCppSymbols.bind(this),
      '.c': this.extractCppSymbols.bind(this),
      '.go': this.extractGoSymbols.bind(this),
      '.rs': this.extractRustSymbols.bind(this),
      '.php': this.extractPhpSymbols.bind(this)
    };
    
    return extractors[extension] || null;
  }
  
  /**
   * Extract symbols from a JavaScript/JSX file
   * @private
   */
  private async extractJavaScriptSymbols(ast: any, symbols: Symbol[], _filePath: string): Promise<void> {
    const rootNode = ast.rootNode;
    // const content = rootNode.text; // Unused variable
    
    // Define a recursive node visitor
    const visitNode = (node: any, parent: Symbol | null = null) => {
      if (!node) return;
      
      // Check node type and extract symbols accordingly
      switch (node.type) {
        case 'function_declaration':
        case 'method_definition':
        case 'arrow_function':
        case 'function': {
          // Extract function name
          const nameNode = node.childForFieldName('name');
          const name = nameNode ? nameNode.text : 'anonymous';
          
          // Create the symbol
          const symbol: Symbol = {
            name,
            type: 'function',
            content: node.text,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            metadata: {
              isAsync: node.childForFieldName('async') !== null
            },
            children: []
          };
          
          // Add to parent or root symbols
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(symbol);
          } else {
            symbols.push(symbol);
          }
          
          // Visit children
          for (let i = 0; i < node.namedChildCount; i++) {
            visitNode(node.namedChild(i), symbol);
          }
          break;
        }
        
        case 'class_declaration': {
          // Extract class name
          const nameNode = node.childForFieldName('name');
          const name = nameNode ? nameNode.text : 'AnonymousClass';
          
          // Check for extends clause
          const extendsNode = node.childForFieldName('extends');
          const extendedClass = extendsNode ? extendsNode.text : null;
          
          // Create the symbol
          const symbol: Symbol = {
            name,
            type: 'class',
            content: node.text,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            metadata: {
              extends: extendedClass
            },
            children: []
          };
          
          // Add to parent or root symbols
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(symbol);
          } else {
            symbols.push(symbol);
          }
          
          // Process class body to extract methods
          const bodyNode = node.childForFieldName('body');
          if (bodyNode) {
            for (let i = 0; i < bodyNode.namedChildCount; i++) {
              visitNode(bodyNode.namedChild(i), symbol);
            }
          }
          break;
        }
        
        case 'variable_declaration': {
          // Process each declarator
          for (let i = 0; i < node.namedChildCount; i++) {
            const declarator = node.namedChild(i);
            if (declarator && declarator.type === 'variable_declarator') {
              const nameNode = declarator.childForFieldName('name');
              const valueNode = declarator.childForFieldName('value');
              
              if (nameNode) {
                const name = nameNode.text;
                // const value = valueNode ? valueNode.text : ''; // Unused variable
                
                // Create the symbol
                const symbol: Symbol = {
                  name,
                  type: 'variable',
                  content: declarator.text,
                  location: {
                    start: { line: declarator.startPosition.row + 1, column: declarator.startPosition.column },
                    end: { line: declarator.endPosition.row + 1, column: declarator.endPosition.column }
                  },
                  metadata: {
                    kind: node.childForFieldName('kind')?.text || 'var'
                  }
                };
                
                // Add to parent or root symbols
                if (parent) {
                  parent.children = parent.children || [];
                  parent.children.push(symbol);
                } else {
                  symbols.push(symbol);
                }
                
                // Check if the value is a function or class
                if (valueNode) {
                  if (valueNode.type === 'function' || 
                      valueNode.type === 'arrow_function' || 
                      valueNode.type === 'class_declaration') {
                    visitNode(valueNode, symbol);
                  }
                }
              }
            }
          }
          break;
        }
        
        case 'import_declaration': {
          // Extract import information
          const symbol: Symbol = {
            name: 'import',
            type: 'import',
            content: node.text,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            metadata: {
              source: node.childForFieldName('source')?.text.replace(/['"]/g, '') || ''
            }
          };
          
          // Add to parent or root symbols
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(symbol);
          } else {
            symbols.push(symbol);
          }
          break;
        }
        
        case 'export_statement': {
          // Extract export information
          const symbol: Symbol = {
            name: 'export',
            type: 'export',
            content: node.text,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            metadata: {}
          };
          
          // Add to parent or root symbols
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(symbol);
          } else {
            symbols.push(symbol);
          }
          
          // Visit the exported declaration
          for (let i = 0; i < node.namedChildCount; i++) {
            visitNode(node.namedChild(i), symbol);
          }
          break;
        }
        
        default:
          // Recursively process other nodes
          for (let i = 0; i < node.namedChildCount; i++) {
            visitNode(node.namedChild(i), parent);
          }
          break;
      }
    };
    
    // Start the traversal from the root
    visitNode(rootNode);
  }
  
  /**
   * Extract symbols from a TypeScript/TSX file
   * Note: This would be similar to JS, but with additional handling for interfaces, types, etc.
   * @private
   */
  private async extractTypeScriptSymbols(ast: any, symbols: Symbol[], filePath: string): Promise<void> {
    // Start with JavaScript symbol extraction as the base
    await this.extractJavaScriptSymbols(ast, symbols, filePath);
    
    const rootNode = ast.rootNode;
    
    // Define a recursive node visitor specifically for TS constructs
    const visitNode = (node: any, parent: Symbol | null = null) => {
      if (!node) return;
      
      // Check node type and extract symbols accordingly
      switch (node.type) {
        case 'interface_declaration': {
          // Extract interface name
          const nameNode = node.childForFieldName('name');
          const name = nameNode ? nameNode.text : 'AnonymousInterface';
          
          // Create the symbol
          const symbol: Symbol = {
            name,
            type: 'interface',
            content: node.text,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            metadata: {},
            children: []
          };
          
          // Add to parent or root symbols
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(symbol);
          } else {
            symbols.push(symbol);
          }
          
          // Process interface body
          const bodyNode = node.childForFieldName('body');
          if (bodyNode) {
            for (let i = 0; i < bodyNode.namedChildCount; i++) {
              visitNode(bodyNode.namedChild(i), symbol);
            }
          }
          break;
        }
        
        case 'type_alias_declaration': {
          // Extract type name
          const nameNode = node.childForFieldName('name');
          const name = nameNode ? nameNode.text : 'AnonymousType';
          
          // Create the symbol
          const symbol: Symbol = {
            name,
            type: 'type',
            content: node.text,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            metadata: {},
            children: []
          };
          
          // Add to parent or root symbols
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(symbol);
          } else {
            symbols.push(symbol);
          }
          break;
        }
        
        case 'enum_declaration': {
          // Extract enum name
          const nameNode = node.childForFieldName('name');
          const name = nameNode ? nameNode.text : 'AnonymousEnum';
          
          // Create the symbol
          const symbol: Symbol = {
            name,
            type: 'enum',
            content: node.text,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            metadata: {},
            children: []
          };
          
          // Add to parent or root symbols
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(symbol);
          } else {
            symbols.push(symbol);
          }
          
          // Process enum body
          const bodyNode = node.childForFieldName('body');
          if (bodyNode) {
            for (let i = 0; i < bodyNode.namedChildCount; i++) {
              visitNode(bodyNode.namedChild(i), symbol);
            }
          }
          break;
        }
        
        default:
          // Recursively process other nodes
          for (let i = 0; i < node.namedChildCount; i++) {
            visitNode(node.namedChild(i), parent);
          }
          break;
      }
    };
    
    // Start the traversal from the root for TS-specific constructs
    visitNode(rootNode);
  }
  
  /**
   * Extract symbols from a Python file
   * @private
   */
  private async extractPythonSymbols(_ast: any, _symbols: Symbol[], _filePath: string): Promise<void> {
    // Placeholder for Python symbol extraction
    console.log('Python symbol extraction not yet implemented');
  }
  
  /**
   * Extract symbols from a Java file
   * @private
   */
  private async extractJavaSymbols(_ast: any, _symbols: Symbol[], _filePath: string): Promise<void> {
    // Placeholder for Java symbol extraction
    console.log('Java symbol extraction not yet implemented');
  }
  
  /**
   * Extract symbols from a Ruby file
   * @private
   */
  private async extractRubySymbols(_ast: any, _symbols: Symbol[], _filePath: string): Promise<void> {
    // Placeholder for Ruby symbol extraction
    console.log('Ruby symbol extraction not yet implemented');
  }
  
  /**
   * Extract symbols from a C/C++ file
   * @private
   */
  private async extractCppSymbols(_ast: any, _symbols: Symbol[], _filePath: string): Promise<void> {
    // Placeholder for C/C++ symbol extraction
    console.log('C/C++ symbol extraction not yet implemented');
  }
  
  /**
   * Extract symbols from a Go file
   * @private
   */
  private async extractGoSymbols(_ast: any, _symbols: Symbol[], _filePath: string): Promise<void> {
    // Placeholder for Go symbol extraction
    console.log('Go symbol extraction not yet implemented');
  }
  
  /**
   * Extract symbols from a Rust file
   * @private
   */
  private async extractRustSymbols(_ast: any, _symbols: Symbol[], _filePath: string): Promise<void> {
    // Placeholder for Rust symbol extraction
    console.log('Rust symbol extraction not yet implemented');
  }
  
  /**
   * Extract symbols from a PHP file
   * @private
   */
  private async extractPhpSymbols(_ast: any, _symbols: Symbol[], _filePath: string): Promise<void> {
    // Placeholder for PHP symbol extraction
    console.log('PHP symbol extraction not yet implemented');
  }
}