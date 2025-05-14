/**
 * Language Analyzer
 * 
 * Identifies programming languages used in a codebase based on file extensions and content.
 * Implements the EmergentAnalyzer interface.
 */

import path from 'path';
import { 
  EmergentAnalyzer, 
  FileNode, 
  LanguageDetails
} from '../unifiedTypes.js';
import { SharedAnalysisContext } from '../sharedAnalysisContext.js';

/**
 * Interface defining language signatures
 */
interface LanguageSignature {
  name: string;
  extensions: string[];
  primaryParadigms: string[];
  filePatterns?: RegExp[];
  contentPatterns?: RegExp[];
}

/**
 * Language analyzer responsible for identifying programming languages
 * used in the codebase. This is a fundamental analyzer that many others depend on.
 */
export class LanguageAnalyzer implements EmergentAnalyzer {
  // Core analyzer properties
  readonly id: string = 'language-analyzer';
  readonly name: string = 'Language Analyzer';
  readonly priority: number = 10; // High priority (low number) since many analyzers depend on language detection
  readonly dependencies: string[] = []; // No dependencies on other analyzers

  // Language detector properties
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
   * Called once at the start of analysis
   */
  async initialize(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Initializing...`);
    
    // Register language detection patterns
    this.registerLanguagePatterns(context);
    
    // Initialize the language map in the context if needed
    if (!context.languages.languages) {
      context.languages.languages = new Map<string, LanguageDetails>();
    }
    
    // Reset paradigm counts
    context.languages.paradigms = {};
    
    // Reset dominant language
    context.languages.dominant = '';
  }

  /**
   * Register language-specific patterns for other analyzers to use
   */
  private registerLanguagePatterns(context: SharedAnalysisContext): void {
    // JavaScript/TypeScript patterns
    context.registerPattern({
      type: 'language_detection',
      name: 'JavaScript Import',
      regex: 'import\\s+[{\\w\\s,}*]+\\s+from\\s+[\'"]([^\'"]+)[\'"]',
      description: 'JavaScript/TypeScript import statement',
      confidence: 0.95,
      metadata: {
        language: ['JavaScript', 'TypeScript']
      }
    });
    
    context.registerPattern({
      type: 'language_detection',
      name: 'TypeScript Type',
      regex: '(interface|type)\\s+([A-Z][a-zA-Z0-9]*)\\s*[<{=]',
      description: 'TypeScript type definition',
      confidence: 0.95,
      metadata: {
        language: 'TypeScript'
      }
    });
    
    // Python patterns
    context.registerPattern({
      type: 'language_detection',
      name: 'Python Import',
      regex: '(import\\s+[\\w.]+|from\\s+[\\w.]+\\s+import)',
      description: 'Python import statement',
      confidence: 0.9,
      metadata: {
        language: 'Python'
      }
    });
    
    context.registerPattern({
      type: 'language_detection',
      name: 'Python Function',
      regex: 'def\\s+[a-zA-Z_][a-zA-Z0-9_]*\\s*\\(',
      description: 'Python function definition',
      confidence: 0.9,
      metadata: {
        language: 'Python'
      }
    });
    
    // Java patterns
    context.registerPattern({
      type: 'language_detection',
      name: 'Java Import',
      regex: 'import\\s+[\\w.]+;',
      description: 'Java import statement',
      confidence: 0.9,
      metadata: {
        language: 'Java'
      }
    });
    
    context.registerPattern({
      type: 'language_detection',
      name: 'Java Class',
      regex: '(public|private|protected)\\s+class\\s+[A-Z][a-zA-Z0-9_]*',
      description: 'Java class definition',
      confidence: 0.9,
      metadata: {
        language: 'Java'
      }
    });
  }

  /**
   * Called for each file during the content analysis phase
   */
  async analyzeFile(file: FileNode, content: string, context: SharedAnalysisContext): Promise<void> {
    // Identify language for this file
    const language = this.identifyLanguage(file, content);
    
    if (language) {
      // Update file metadata with language type
      file.languageType = language.name;
      
      // Update language details in the shared context
      this.updateLanguageDetails(context, file, language);
      
      // Look for additional language patterns in the content
      this.detectLanguagePatterns(context, file, content, language);
    }
  }

  /**
   * Update language details in the shared context
   */
  private updateLanguageDetails(context: SharedAnalysisContext, file: FileNode, language: LanguageSignature): void {
    const languages = context.languages.languages;
    
    // Create or update language entry
    if (!languages.has(language.name)) {
      languages.set(language.name, {
        name: language.name,
        extensions: language.extensions,
        paths: [file.path],
        fileCount: 1,
        totalSize: file.size,
        dominantParadigms: language.primaryParadigms,
        filesByPath: { [file.path]: file }
      });
    } else {
      const langDetails = languages.get(language.name)!;
      langDetails.paths.push(file.path);
      langDetails.fileCount++;
      langDetails.totalSize += file.size;
      langDetails.filesByPath[file.path] = file;
    }
    
    // Update paradigm counts
    for (const paradigm of language.primaryParadigms) {
      context.languages.paradigms[paradigm] = (context.languages.paradigms[paradigm] || 0) + 1;
    }
    
    // Update file extension counts
    const extension = path.extname(file.path).toLowerCase();
    context.fileSystem.fileExtensions[extension] = (context.fileSystem.fileExtensions[extension] || 0) + 1;
    
    // Update language counts
    context.fileSystem.languageCounts[language.name] = (context.fileSystem.languageCounts[language.name] || 0) + 1;
  }

  /**
   * Look for additional language-specific patterns in the content
   */
  private detectLanguagePatterns(
    context: SharedAnalysisContext, 
    file: FileNode, 
    content: string, 
    language: LanguageSignature
  ): void {
    // Find language-specific patterns in the content
    const patterns = context.findMatchingPatterns(content, 'language_detection');
    
    // Record any significant patterns in file metadata
    if (patterns.length > 0) {
      file.metadata = file.metadata || {};
      file.metadata.languagePatterns = patterns.map(p => ({
        patternId: p.patternId,
        match: p.match,
        index: p.index,
        confidence: p.confidence
      }));
    }
  }

  /**
   * Called after all files have been processed
   */
  async processRelationships(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Processing language relationships...`);
    
    // Determine dominant language
    this.identifyDominantLanguage(context);
    
    // Look for language-related relationships
    this.detectLanguageRelationships(context);
  }

  /**
   * Identify the dominant language in the codebase
   */
  private identifyDominantLanguage(context: SharedAnalysisContext): void {
    let maxFiles = 0;
    let dominantLanguage = '';
    
    for (const [lang, details] of context.languages.languages.entries()) {
      if (details.fileCount > maxFiles) {
        maxFiles = details.fileCount;
        dominantLanguage = lang;
      }
    }
    
    context.languages.dominant = dominantLanguage;
    
    console.log(`[${this.name}] Detected ${context.languages.languages.size} languages, dominant: ${dominantLanguage}`);
  }

  /**
   * Detect relationships between different languages
   */
  private detectLanguageRelationships(context: SharedAnalysisContext): void {
    // Add language-based relationships
    const languages = context.languages.languages;
    
    // For multi-language projects, add relationships between language files
    // that might interact (e.g., TypeScript and JavaScript)
    if (languages.has('TypeScript') && languages.has('JavaScript')) {
      // These languages definitely interact
      context.recordEvent('language-relationship', {
        sourceLanguage: 'TypeScript',
        targetLanguage: 'JavaScript',
        type: 'compiles_to',
        strength: 'strong'
      });
    }
    
    if (languages.has('TypeScript') && languages.has('HTML')) {
      // Frontend relationship
      context.recordEvent('language-relationship', {
        sourceLanguage: 'TypeScript',
        targetLanguage: 'HTML',
        type: 'renders_with',
        strength: 'medium'
      });
    }
    
    // Similar relationships could be added for other common language combinations
  }

  /**
   * Explicitly added method for the IndexingCoordinator to call
   */
  async detectLanguages(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Starting dedicated language detection...`);
    
    // Initial language detection is already done incrementally in analyzeFile
    // This method just ensures the language information is consistent and complete
    
    // Update the dominant language in case it wasn't set
    this.identifyDominantLanguage(context);
    
    // Log summary
    console.log(`[${this.name}] Language detection complete. Found ${context.languages.languages.size} languages.`);
  }

  /**
   * Called to discover and refine patterns
   */
  async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Discovering language-related patterns...`);
    
    // Language analyzer doesn't discover complex patterns on its own
    // This is primarily handled by the pattern analyzer
    // But we can discover language usage patterns
    
    // Analyze directory structure to identify language-specific directories
    this.findLanguageDirectoryPatterns(context);
  }

  /**
   * Find directories that are predominantly in one language
   */
  private findLanguageDirectoryPatterns(context: SharedAnalysisContext): void {
    // Group files by directory and language
    const directoryLanguages: Record<string, Record<string, number>> = {};
    
    // Collect all language information per directory
    for (const [lang, details] of context.languages.languages.entries()) {
      for (const filePath of details.paths) {
        const dirPath = path.dirname(filePath);
        
        if (!directoryLanguages[dirPath]) {
          directoryLanguages[dirPath] = {};
        }
        
        directoryLanguages[dirPath][lang] = (directoryLanguages[dirPath][lang] || 0) + 1;
      }
    }
    
    // Find directories with a dominant language (>80% of files)
    for (const [dirPath, langCounts] of Object.entries(directoryLanguages)) {
      const totalFiles = Object.values(langCounts).reduce((sum, count) => sum + count, 0);
      
      for (const [lang, count] of Object.entries(langCounts)) {
        const percentage = count / totalFiles;
        
        if (percentage > 0.8 && count >= 3) {
          // This is a language-specific directory
          context.recordEvent('language-directory-pattern', {
            directory: dirPath,
            language: lang,
            fileCount: count,
            percentage: percentage,
            confidence: percentage
          });
        }
      }
    }
  }

  /**
   * Final integration phase
   */
  async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Integrating language analysis...`);
    
    // Add language statistics to metrics
    context.recordMetric('languages_detected', context.languages.languages.size);
    context.recordMetric('dominant_language_files', 
      context.languages.languages.get(context.languages.dominant)?.fileCount || 0);
    
    // Create a record of languages by file extensions
    const extensionLanguageMap: Record<string, string> = {};
    
    for (const [lang, details] of context.languages.languages.entries()) {
      for (const ext of details.extensions) {
        extensionLanguageMap[ext] = lang;
      }
    }
    
    // Add extension map as metadata
    context.fileSystem.metadata = context.fileSystem.metadata || {};
    context.fileSystem.metadata.extensionLanguageMap = extensionLanguageMap;
    
    // Calculate language distribution metrics
    const totalFiles = context.fileSystem.fileCount;
    const languageDistribution: Record<string, number> = {};
    
    for (const [lang, details] of context.languages.languages.entries()) {
      const percentage = totalFiles > 0 ? details.fileCount / totalFiles : 0;
      languageDistribution[lang] = percentage;
      
      // Record metric for each language
      context.recordMetric(`language_${lang.toLowerCase()}_percentage`, percentage * 100);
    }
    
    // Add to context metadata
    context.fileSystem.metadata.languageDistribution = languageDistribution;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // No special cleanup needed for the language analyzer
    return Promise.resolve();
  }

  /**
   * Identify the language of a file based on extension and optionally content
   */
  private identifyLanguage(file: FileNode, content?: string): LanguageSignature | null {
    const extension = path.extname(file.path).toLowerCase();
    
    // First, try to match by extension
    for (const signature of this.signatures) {
      if (signature.extensions.includes(extension)) {
        return signature;
      }
    }
    
    // If extension matching failed and we have content, try content-based detection
    if (content && content.length > 0) {
      // Simple content-based heuristics (would be more sophisticated in a full implementation)
      if (/import\s+React|export\s+default|const\s+\w+\s*=/.test(content)) {
        return this.signatures.find(s => s.name === 'JavaScript') || null;
      }
      
      if (/interface\s+\w+|type\s+\w+\s*=|export\s+class/.test(content)) {
        return this.signatures.find(s => s.name === 'TypeScript') || null;
      }
      
      if (/def\s+\w+\s*\(|import\s+\w+|class\s+\w+\s*:/.test(content)) {
        return this.signatures.find(s => s.name === 'Python') || null;
      }
      
      if (/public\s+class|private\s+static|package\s+\w+;/.test(content)) {
        return this.signatures.find(s => s.name === 'Java') || null;
      }
    }
    
    return null;
  }
}