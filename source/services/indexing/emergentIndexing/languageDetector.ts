/**
 * Language Detector
 * 
 * Identifies programming languages used in a codebase based on file extensions and content.
 */

import path from 'path';
import { FileSystemTree, FileNode, DirectoryNode, LanguageStructure, LanguageDetails } from './types.js';

interface LanguageSignature {
  name: string;
  extensions: string[];
  primaryParadigms: string[];
  filePatterns?: RegExp[];
  contentPatterns?: RegExp[];
}

/**
 * Language detector for identifying programming languages in a codebase
 */
export class LanguageDetector {
  private signatures: LanguageSignature[];
  
  constructor() {
    // Define language signatures
    this.signatures = [
      {
        name: 'JavaScript',
        extensions: ['.js', '.jsx', '.mjs'],
        primaryParadigms: ['functional', 'object-oriented', 'event-driven']
      },
      {
        name: 'TypeScript',
        extensions: ['.ts', '.tsx'],
        primaryParadigms: ['object-oriented', 'functional']
      },
      {
        name: 'Python',
        extensions: ['.py', '.pyi', '.pyx'],
        primaryParadigms: ['object-oriented', 'functional', 'imperative']
      },
      {
        name: 'Java',
        extensions: ['.java'],
        primaryParadigms: ['object-oriented']
      },
      {
        name: 'C#',
        extensions: ['.cs'],
        primaryParadigms: ['object-oriented', 'functional']
      },
      {
        name: 'PHP',
        extensions: ['.php', '.phtml'],
        primaryParadigms: ['object-oriented', 'procedural']
      },
      {
        name: 'Ruby',
        extensions: ['.rb', '.rake'],
        primaryParadigms: ['object-oriented', 'functional', 'imperative']
      },
      {
        name: 'Go',
        extensions: ['.go'],
        primaryParadigms: ['procedural', 'concurrent']
      },
      {
        name: 'Rust',
        extensions: ['.rs'],
        primaryParadigms: ['functional', 'object-oriented', 'concurrent']
      },
      {
        name: 'C',
        extensions: ['.c', '.h'],
        primaryParadigms: ['procedural', 'imperative']
      },
      {
        name: 'C++',
        extensions: ['.cpp', '.hpp', '.cc', '.hh', '.cxx', '.hxx'],
        primaryParadigms: ['object-oriented', 'procedural', 'generic']
      },
      {
        name: 'Swift',
        extensions: ['.swift'],
        primaryParadigms: ['object-oriented', 'functional', 'protocol-oriented']
      },
      {
        name: 'Kotlin',
        extensions: ['.kt', '.kts'],
        primaryParadigms: ['object-oriented', 'functional']
      },
      {
        name: 'HTML',
        extensions: ['.html', '.htm', '.xhtml'],
        primaryParadigms: ['markup']
      },
      {
        name: 'CSS',
        extensions: ['.css', '.scss', '.sass', '.less', '.styl'],
        primaryParadigms: ['declarative', 'rule-based']
      },
      {
        name: 'JSON',
        extensions: ['.json'],
        primaryParadigms: ['data']
      },
      {
        name: 'YAML',
        extensions: ['.yml', '.yaml'],
        primaryParadigms: ['data']
      },
      {
        name: 'XML',
        extensions: ['.xml', '.svg', '.xsl'],
        primaryParadigms: ['markup']
      },
      {
        name: 'Markdown',
        extensions: ['.md', '.markdown'],
        primaryParadigms: ['markup']
      },
      {
        name: 'Shell',
        extensions: ['.sh', '.bash', '.zsh'],
        primaryParadigms: ['procedural', 'scripting']
      },
      {
        name: 'PowerShell',
        extensions: ['.ps1', '.psm1'],
        primaryParadigms: ['procedural', 'object-oriented', 'scripting']
      },
      {
        name: 'SQL',
        extensions: ['.sql'],
        primaryParadigms: ['declarative', 'query']
      },
      {
        name: 'R',
        extensions: ['.r', '.R'],
        primaryParadigms: ['functional', 'array-oriented']
      },
      {
        name: 'Dart',
        extensions: ['.dart'],
        primaryParadigms: ['object-oriented']
      },
      {
        name: 'Scala',
        extensions: ['.scala'],
        primaryParadigms: ['functional', 'object-oriented']
      },
      {
        name: 'Groovy',
        extensions: ['.groovy'],
        primaryParadigms: ['object-oriented', 'functional']
      },
      {
        name: 'Perl',
        extensions: ['.pl', '.pm'],
        primaryParadigms: ['procedural', 'object-oriented', 'functional']
      },
      {
        name: 'Lua',
        extensions: ['.lua'],
        primaryParadigms: ['procedural', 'object-oriented', 'functional']
      },
      {
        name: 'Clojure',
        extensions: ['.clj', '.cljs', '.cljc'],
        primaryParadigms: ['functional']
      },
      {
        name: 'Haskell',
        extensions: ['.hs', '.lhs'],
        primaryParadigms: ['functional']
      },
      {
        name: 'Erlang',
        extensions: ['.erl', '.hrl'],
        primaryParadigms: ['functional', 'concurrent']
      },
      {
        name: 'Elixir',
        extensions: ['.ex', '.exs'],
        primaryParadigms: ['functional', 'concurrent']
      },
      {
        name: 'Julia',
        extensions: ['.jl'],
        primaryParadigms: ['functional', 'numerical', 'multiple-dispatch']
      },
      {
        name: 'MATLAB',
        extensions: ['.m'],
        primaryParadigms: ['array-oriented', 'procedural']
      }
    ];
  }
  
  /**
   * Detect languages used in a codebase
   */
  async detectLanguages(fileSystem: FileSystemTree): Promise<LanguageStructure> {
    console.log('Detecting languages in the codebase...');
    
    const languageMap = new Map<string, LanguageDetails>();
    const paradigmCounts: Record<string, number> = {};
    
    // Extract all files from the file system tree
    const files = this.getAllFiles(fileSystem.root);
    
    // Count files by extension
    for (const file of files) {
      // Find matching language signature
      const language = this.identifyLanguage(file);
      
      if (language) {
        // Update language details
        if (!languageMap.has(language.name)) {
          languageMap.set(language.name, {
            name: language.name,
            extensions: language.extensions,
            paths: [],
            fileCount: 0,
            totalSize: 0,
            dominantParadigms: language.primaryParadigms,
            filesByPath: {}
          });
        }
        
        const langDetails = languageMap.get(language.name)!;
        langDetails.paths.push(file.path);
        langDetails.fileCount++;
        langDetails.totalSize += file.size;
        langDetails.filesByPath[file.path] = file;
        
        // Update paradigm counts
        for (const paradigm of language.primaryParadigms) {
          paradigmCounts[paradigm] = (paradigmCounts[paradigm] || 0) + 1;
        }
      }
    }
    
    // Determine dominant language
    let dominantLanguage = '';
    let maxFiles = 0;
    
    for (const [lang, details] of languageMap.entries()) {
      if (details.fileCount > maxFiles) {
        maxFiles = details.fileCount;
        dominantLanguage = lang;
      }
    }
    
    return {
      languages: languageMap,
      dominant: dominantLanguage,
      paradigms: paradigmCounts
    };
  }
  
  /**
   * Get all files from the file system tree
   * @private
   */
  private getAllFiles(node: DirectoryNode | FileNode): FileNode[] {
    const files: FileNode[] = [];
    
    if ('extension' in node) {
      // This is a file node
      files.push(node);
    } else if ('children' in node && node.children) {
      // This is a directory node with children
      for (const child of node.children) {
        files.push(...this.getAllFiles(child));
      }
    }
    
    return files;
  }
  
  /**
   * Identify the language of a file
   * @private
   */
  private identifyLanguage(file: FileNode): LanguageSignature | null {
    const extension = path.extname(file.path).toLowerCase();
    
    // First, try to match by extension
    for (const signature of this.signatures) {
      if (signature.extensions.includes(extension)) {
        return signature;
      }
    }
    
    // TODO: If extension match fails, try content-based identification
    // This would involve examining file content for language-specific patterns
    
    return null;
  }
}