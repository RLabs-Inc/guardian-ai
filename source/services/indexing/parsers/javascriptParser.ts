// source/services/indexing/parsers/javascriptParser.ts
import { BaseParser } from './baseParser.js';
import { TreeSitterManager } from '../treeSitter.js';
import { CodeSymbol, CodeDependency, CodeLocation } from '../types.js';
import * as jsQueries from '../queries/javascript.js';
import Parser from 'tree-sitter';

/**
 * Parser implementation for JavaScript and TypeScript
 */
export class JavaScriptParser extends BaseParser {
  private treeSitter: TreeSitterManager;
  
  constructor() {
    super(['.js', '.jsx', '.ts', '.tsx']);
    this.treeSitter = TreeSitterManager.getInstance();
  }
  
  async initialize(): Promise<void> {
    await this.treeSitter.initialize();
  }
  
  async parseFile(filePath: string, content: string, extension: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    
    // Parse the file with Tree-sitter
    const tree = this.treeSitter.parse(content, extension);
    if (!tree) {
      console.warn(`Failed to parse ${filePath} with Tree-sitter`);
      return symbols;
    }
    
    // Extract functions
    await this.extractFunctions(tree, content, filePath, symbols);
    
    // Extract classes
    await this.extractClasses(tree, content, filePath, symbols);
    
    // Extract interfaces (TypeScript only)
    if (extension === '.ts' || extension === '.tsx') {
      await this.extractInterfaces(tree, content, filePath, symbols);
    }
    
    return symbols;
  }
  
  private async extractFunctions(tree: Parser.Tree, content: string, filePath: string, symbols: CodeSymbol[]): Promise<void> {
    const query = this.treeSitter.createQuery('.js', jsQueries.FUNCTION_QUERY);
    if (!query) return;
    
    const matches = query.matches(tree.rootNode);
    
    for (const match of matches) {
      const functionCapture = match.captures.find(c => c.name === 'function.declaration')?.node;
      const nameCapture = match.captures.find(c => c.name === 'function.name')?.node;
      
      if (functionCapture && nameCapture) {
        const name = nameCapture.text;
        const startLine = functionCapture.startPosition.row + 1; // 1-indexed for users
        const endLine = functionCapture.endPosition.row + 1;
        
        // Extract function parameters
        const params = this.extractFunctionParameters(functionCapture);
        
        symbols.push({
          name,
          type: 'function',
          location: {
            filePath,
            startLine,
            endLine,
            startColumn: functionCapture.startPosition.column,
            endColumn: functionCapture.endPosition.column
          },
          signature: `function ${name}(${params.join(', ')})`,
          content: this.extractLines(content, startLine, endLine)
        });
      }
    }
  }
  
  private extractFunctionParameters(functionNode: Parser.SyntaxNode): string[] {
    const params: string[] = [];
    
    // Find formal parameters node
    const paramsNode = functionNode.namedChildren.find(
      child => child.type === 'formal_parameters'
    );
    
    if (paramsNode) {
      // Extract each parameter
      paramsNode.namedChildren.forEach(param => {
        if (param.type === 'identifier') {
          params.push(param.text);
        }
      });
    }
    
    return params;
  }
  
  private async extractClasses(tree: Parser.Tree, content: string, filePath: string, symbols: CodeSymbol[]): Promise<void> {
    const query = this.treeSitter.createQuery('.js', jsQueries.CLASS_QUERY);
    if (!query) return;
    
    const matches = query.matches(tree.rootNode);
    
    for (const match of matches) {
      const classCapture = match.captures.find(c => c.name === 'class.declaration')?.node;
      const nameCapture = match.captures.find(c => c.name === 'class.name')?.node;
      
      if (classCapture && nameCapture) {
        const name = nameCapture.text;
        const startLine = classCapture.startPosition.row + 1;
        const endLine = classCapture.endPosition.row + 1;
        
        symbols.push({
          name,
          type: 'class',
          location: {
            filePath,
            startLine,
            endLine,
            startColumn: classCapture.startPosition.column,
            endColumn: classCapture.endPosition.column
          },
          content: this.extractLines(content, startLine, endLine)
        });
      }
    }
  }
  
  private async extractInterfaces(tree: Parser.Tree, content: string, filePath: string, symbols: CodeSymbol[]): Promise<void> {
    const query = this.treeSitter.createQuery('.ts', jsQueries.INTERFACE_QUERY);
    if (!query) return;
    
    const matches = query.matches(tree.rootNode);
    
    for (const match of matches) {
      const interfaceCapture = match.captures.find(c => c.name === 'interface.declaration')?.node;
      const nameCapture = match.captures.find(c => c.name === 'interface.name')?.node;
      
      if (interfaceCapture && nameCapture) {
        const name = nameCapture.text;
        const startLine = interfaceCapture.startPosition.row + 1;
        const endLine = interfaceCapture.endPosition.row + 1;
        
        symbols.push({
          name,
          type: 'interface',
          location: {
            filePath,
            startLine,
            endLine,
            startColumn: interfaceCapture.startPosition.column,
            endColumn: interfaceCapture.endPosition.column
          },
          content: this.extractLines(content, startLine, endLine)
        });
      }
    }
  }
  
  async extractDependencies(filePath: string, content: string, extension: string): Promise<CodeDependency[]> {
    const dependencies: CodeDependency[] = [];
    
    // Parse the file with Tree-sitter
    const tree = this.treeSitter.parse(content, extension);
    if (!tree) {
      return dependencies;
    }
    
    // Extract imports
    const query = this.treeSitter.createQuery(extension, jsQueries.IMPORT_QUERY);
    if (!query) return dependencies;
    
    const matches = query.matches(tree.rootNode);
    
    for (const match of matches) {
      const sourceCapture = match.captures.find(c => c.name === 'import.source')?.node;
      
      if (sourceCapture) {
        const target = sourceCapture.text.replace(/['"]/g, ''); // Remove quotes
        
        dependencies.push({
          source: filePath,
          target,
          type: 'import'
        });
      }
    }
    
    return dependencies;
  }
}