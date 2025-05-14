/**
 * Dependency Analyzer
 * 
 * Analyzes import relationships in codebases following the emergent indexing philosophy.
 * Rather than making assumptions about specific languages or frameworks, this analyzer
 * discovers dependency patterns by examining the content of files and identifying import-like
 * constructs based on patterns that emerge from the codebase itself.
 */

import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileSystemService } from '../../fileSystem/types.js';
import { 
  IDependencyAnalyzer, 
  CodebaseUnderstanding, 
  DependencyGraph, 
  ImportStatement, 
  ExportStatement,
  Dependency,
  DependencyType,
  FileNode,
  DirectoryNode,
  Relationship,
  RelationshipType
} from './types.js';

/**
 * Analyzes dependencies across files in a codebase without making assumptions
 * about programming languages, frameworks, or organization.
 */
export class DependencyAnalyzer implements IDependencyAnalyzer {
  private fileSystem: FileSystemService;
  
  // Patterns discovered during the analysis
  private importPatterns: Map<string, RegExp> = new Map();
  private exportPatterns: Map<string, RegExp> = new Map();
  
  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  /**
   * Analyze all dependencies in the codebase using an emergent approach that
   * makes no assumptions about languages, frameworks, or organization.
   */
  async analyzeDependencies(understanding: CodebaseUnderstanding): Promise<DependencyGraph> {
    console.log('Starting emergent dependency analysis...');
    
    // Initialize the dependency graph
    const dependencies = new Map<string, Dependency>();
    const imports: ImportStatement[] = [];
    const exports: ExportStatement[] = [];
    
    // Phase 1: Discover import/export patterns from the codebase itself
    await this.discoverDependencyPatterns(understanding);
    console.log(`Discovered ${this.importPatterns.size} import patterns and ${this.exportPatterns.size} export patterns`);
    
    // Phase 2: Apply discovered patterns to identify dependencies
    await this.processFiles(understanding, imports, exports, dependencies);
    
    // Phase 3: Analyze relationships to enrich dependency understanding
    await this.enrichDependencyUnderstanding(understanding, imports, exports, dependencies);
    
    // Build the dependency graph
    const graph: DependencyGraph = {
      dependencies,
      imports,
      exports
    };
    
    // Update understanding with dependency information
    understanding.dependencies = graph;
    understanding.updatedAt = new Date();
    
    console.log(`Dependency analysis complete: ${dependencies.size} dependencies, ${imports.length} imports, ${exports.length} exports`);
    
    return graph;
  }
  
  /**
   * Discover import and export patterns from the codebase
   * Following emergent principles - learn from the code itself
   * @private
   */
  private async discoverDependencyPatterns(understanding: CodebaseUnderstanding): Promise<void> {
    // Common import/export patterns across various languages
    // We don't hardcode these; we'll use them as initial seeds and then evolve them
    // based on what we discover in the actual codebase
    const initialPatterns = [
      // JavaScript/TypeScript style
      { type: 'import', regex: /import\s+(?:{\s*([^}]+)\s*}|([^{}\s]+))\s+from\s+['"]([@\w\-/.]+)['"]/g },
      { type: 'import', regex: /import\s*\(\s*['"]([@\w\-/.]+)['"]\s*\)/g },
      { type: 'export', regex: /export\s+(?:{\s*([^}]+)\s*}|default\s+([^{\s;]+)|([^{\s;]+))/g },
      
      // Python style
      { type: 'import', regex: /import\s+([\w.]+)(?:\s+as\s+\w+)?/g },
      { type: 'import', regex: /from\s+([\w.]+)\s+import/g },
      
      // Ruby style
      { type: 'import', regex: /require\s+['"]([\w\-/.]+)['"]/g },
      
      // Go style
      { type: 'import', regex: /import\s+\(\s*['"]([\w\-/.]+)['"]/g },
      
      // Java/C# style
      { type: 'import', regex: /import\s+([\w.]+\*?);/g },
      { type: 'import', regex: /using\s+([\w.]+);/g },
      
      // PHP style
      { type: 'import', regex: /use\s+([\w\\]+)(?:\s+as\s+\w+)?;/g },
      { type: 'import', regex: /require(?:_once)?\s*\(['"]([\w\-/.]+)['"]\)/g },
    ];
    
    // Initialize patterns
    for (const pattern of initialPatterns) {
      if (pattern.type === 'import') {
        this.importPatterns.set(`initial_${this.importPatterns.size}`, pattern.regex);
      } else {
        this.exportPatterns.set(`initial_${this.exportPatterns.size}`, pattern.regex);
      }
    }
    
    // Phase 1: Sample files to detect patterns specific to this codebase
    const sampleFiles = await this.selectRepresentativeSample(understanding);
    
    // Extract and count potential import patterns from the sample
    const patternCounts = new Map<string, number>();
    
    for (const fileInfo of sampleFiles) {
      const content = fileInfo.content;
      if (!content) continue;
      
      // Apply initial patterns to find seeds
      for (const [patternId, pattern] of this.importPatterns.entries()) {
        const matches = [...content.matchAll(pattern)];
        for (const match of matches) {
          const fullMatch = match[0];
          patternCounts.set(fullMatch, (patternCounts.get(fullMatch) || 0) + 1);
        }
      }
      
      // Look for additional potential patterns
      // 1. Lines with path-like strings (common in import statements)
      const pathLikeRegex = /['"]([@\w\-/.]+)['"]/g;
      const pathMatches = [...content.matchAll(pathLikeRegex)];
      
      // 2. Look for lines with keywords that might indicate imports
      const importKeywordRegex = /\b(import|require|include|using|from|use)\b/g;
      const keywordMatches = [...content.matchAll(importKeywordRegex)];
      
      // Check lines with both path-like strings and import keywords
      for (const pathMatch of pathMatches) {
        const line = content.substring(
          content.lastIndexOf('\n', pathMatch.index!) + 1,
          content.indexOf('\n', pathMatch.index!)
        );
        
        if (importKeywordRegex.test(line)) {
          patternCounts.set(line.trim(), (patternCounts.get(line.trim()) || 0) + 1);
        }
      }
    }
    
    // Process candidates - consider frequent patterns as legitimate import patterns
    const patternCandidates = Array.from(patternCounts.entries())
      .filter(([_, count]) => count >= 3) // Must appear at least 3 times
      .sort((a, b) => b[1] - a[1]); // Sort by frequency
    
    // Extract new patterns from candidates
    for (const [candidate, _] of patternCandidates) {
      try {
        // Try to generalize the pattern by replacing specific paths with regex captures
        const generalizedPattern = candidate
          .replace(/['"][@\w\-/.]+['"]/g, '[\'"]([^\'"]*)[\'"\\)]') // Replace paths
          .replace(/\b\w+\b(?![\s]*:)/g, '\\w+') // Replace identifiers
          .replace(/\s+/g, '\\s+'); // Normalize whitespace
        
        // Create a new regex pattern
        const newPattern = new RegExp(generalizedPattern, 'g');
        
        // Add as a discovered pattern
        if (candidate.match(importKeywordRegex)) {
          this.importPatterns.set(`discovered_${this.importPatterns.size}`, newPattern);
        } else if (candidate.match(/\b(export|module\.exports)\b/)) {
          this.exportPatterns.set(`discovered_${this.exportPatterns.size}`, newPattern);
        }
      } catch (e) {
        // Invalid regex, skip this candidate
        continue;
      }
    }
    
    // Refine patterns by combining similar ones
    this.consolidatePatterns();
  }
  
  /**
   * Process all files in the codebase to extract import and export information
   * Using the discovered patterns to identify dependencies
   * @private
   */
  private async processFiles(
    understanding: CodebaseUnderstanding,
    imports: ImportStatement[],
    exports: ExportStatement[],
    dependencies: Map<string, Dependency>
  ): Promise<void> {
    const processedExtensions = new Set<string>();
    
    // Process each file in the file system tree
    const processDirectory = async (directory: DirectoryNode) => {
      for (const child of directory.children) {
        if ('extension' in child) {
          // It's a file
          await this.processFile(
            child,
            understanding,
            imports,
            exports,
            dependencies
          );
          processedExtensions.add(child.extension || '');
        } else {
          // It's a directory
          await processDirectory(child);
        }
      }
    };
    
    await processDirectory(understanding.fileSystem.root);
    
    console.log(`Processed files with extensions: ${Array.from(processedExtensions).join(', ')}`);
  }
  
  /**
   * Process a single file to extract its imports and exports
   * using the discovered patterns
   * @private
   */
  private async processFile(
    fileNode: FileNode,
    understanding: CodebaseUnderstanding,
    imports: ImportStatement[],
    exports: ExportStatement[],
    dependencies: Map<string, Dependency>
  ): Promise<void> {
    const filePath = fileNode.path;
    
    try {
      // Get the file content
      const contentRef = fileNode.content;
      let content: string;
      
      if (typeof contentRef === 'string') {
        content = contentRef;
      } else if (contentRef && typeof contentRef === 'object' && 'reference' in contentRef) {
        // Reference to a file, need to read it
        const fileContent = await this.fileSystem.readFile(filePath);
        content = fileContent.content || '';
      } else {
        // No content available
        return;
      }
      
      // Extract imports using discovered patterns
      await this.extractImports(
        filePath,
        content,
        understanding,
        imports,
        dependencies
      );
      
      // Extract exports using discovered patterns
      await this.extractExports(
        filePath,
        content,
        exports
      );
    } catch (error) {
      console.error(`Error processing file ${filePath} for dependency analysis:`, error);
    }
  }
  
  /**
   * Extract import statements from a file using discovered patterns
   * @private
   */
  private async extractImports(
    filePath: string,
    content: string,
    understanding: CodebaseUnderstanding,
    imports: ImportStatement[],
    dependencies: Map<string, Dependency>
  ): Promise<void> {
    // Apply all discovered import patterns
    for (const [patternId, pattern] of this.importPatterns.entries()) {
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        // Try to extract the module path from the match
        // Most import patterns will have the module path in a capture group
        let moduleSpecifier = '';
        for (let i = 1; i < match.length; i++) {
          if (match[i] && typeof match[i] === 'string') {
            const candidate = match[i].trim();
            if (candidate.length > 0 && !candidate.includes(' ')) {
              moduleSpecifier = candidate;
              break;
            }
          }
        }
        
        // If we didn't find a module specifier, try to extract it using a path-like regex
        if (!moduleSpecifier) {
          const pathMatch = /['"]([^'"]+)['"]/g.exec(match[0]);
          if (pathMatch && pathMatch[1]) {
            moduleSpecifier = pathMatch[1];
          }
        }
        
        // Skip if we couldn't identify a module specifier
        if (!moduleSpecifier) continue;
        
        // Create import statement
        const importId = uuidv4();
        const sourceFileId = this.getNodeIdForPath(understanding, filePath);
        const lineNumber = this.getLineNumber(content, match.index || 0);
        
        const importStmt: ImportStatement = {
          id: importId,
          moduleSpecifier,
          importedSymbols: [], // Will fill this later with more detailed analysis
          sourceFileId,
          sourceFilePath: filePath,
          line: lineNumber,
          dependencyType: this.inferDependencyType(moduleSpecifier, filePath, understanding),
          confidence: 0.8, // Less than 1.0 because we're using pattern inference
        };
        
        imports.push(importStmt);
        
        // Update or create the dependency record
        this.updateDependencyForImport(dependencies, importStmt);
      }
    }
  }
  
  /**
   * Extract export statements from a file using discovered patterns
   * @private
   */
  private async extractExports(
    filePath: string,
    content: string,
    exports: ExportStatement[]
  ): Promise<void> {
    // Apply all discovered export patterns
    for (const [patternId, pattern] of this.exportPatterns.entries()) {
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        // Try to extract the exported symbols
        const exportedSymbols: string[] = [];
        
        // Check for named exports using common patterns like 'export { a, b, c }'
        const namedExportsMatch = /{\s*([^}]+)\s*}/.exec(match[0]);
        if (namedExportsMatch && namedExportsMatch[1]) {
          // Split the comma-separated list
          const names = namedExportsMatch[1].split(',').map(name => name.trim());
          exportedSymbols.push(...names);
        }
        
        // Check for single exports like 'export const x ='
        const singleExportMatch = /export\s+(?:const|let|var|function|class)\s+(\w+)/i.exec(match[0]);
        if (singleExportMatch && singleExportMatch[1]) {
          exportedSymbols.push(singleExportMatch[1]);
        }
        
        // Check for default exports
        let defaultExport: string | undefined;
        const defaultExportMatch = /export\s+default\s+(\w+)/i.exec(match[0]);
        if (defaultExportMatch && defaultExportMatch[1]) {
          defaultExport = defaultExportMatch[1];
        }
        
        // Skip if we couldn't identify any exports
        if (exportedSymbols.length === 0 && !defaultExport) continue;
        
        // Create export statement
        const exportId = uuidv4();
        const lineNumber = this.getLineNumber(content, match.index || 0);
        
        const exportStmt: ExportStatement = {
          id: exportId,
          exportedSymbols,
          defaultExport,
          sourceFileId: filePath, // Using filePath as ID since we don't have explicit IDs
          sourceFilePath: filePath,
          line: lineNumber,
          confidence: 0.7, // Less than imports because export detection is less reliable
        };
        
        exports.push(exportStmt);
      }
    }
  }
  
  /**
   * Infer the dependency type based on the module specifier and context
   * @private
   */
  private inferDependencyType(
    moduleSpecifier: string, 
    sourceFilePath: string,
    understanding: CodebaseUnderstanding
  ): DependencyType {
    // Check if it's a relative path (local file)
    if (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../') || moduleSpecifier.startsWith('/')) {
      return DependencyType.LOCAL_FILE;
    }
    
    // Check if it appears to be from the current project (internal module)
    // This is a heuristic: if the module name matches a top-level directory in the project
    const rootDirs = understanding.fileSystem.root.children
      .filter(child => !('extension' in child))
      .map(child => child.name.toLowerCase());
    
    const topLevelName = moduleSpecifier.split('/')[0].toLowerCase();
    if (rootDirs.includes(topLevelName)) {
      return DependencyType.INTERNAL_MODULE;
    }
    
    // Check package.json dependencies if available
    try {
      const packageJsonPath = path.join(understanding.rootPath, 'package.json');
      const fileResult = await this.fileSystem.readFile(packageJsonPath);
      if (fileResult && fileResult.content) {
        const packageJson = JSON.parse(fileResult.content);
        
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        };
        
        // Check if this is a package dependency
        const packageName = this.getPackageNameFromSpecifier(moduleSpecifier);
        if (packageName in allDeps) {
          return DependencyType.EXTERNAL_PACKAGE;
        }
      }
    } catch (error) {
      // No package.json or other error, continue with heuristics
    }
    
    // If we have information on standard library modules, use it
    if (this.isLikelyStandardLibrary(moduleSpecifier)) {
      return DependencyType.STANDARD_LIBRARY;
    }
    
    // Default to treating it as an external package
    return DependencyType.EXTERNAL_PACKAGE;
  }
  
  /**
   * Update or create a dependency record for an import statement
   * @private
   */
  private updateDependencyForImport(
    dependencies: Map<string, Dependency>,
    importStmt: ImportStatement
  ): void {
    const { moduleSpecifier, importedSymbols, dependencyType, sourceFilePath } = importStmt;
    
    // Use the module specifier as the dependency identifier
    if (!dependencies.has(moduleSpecifier)) {
      // Create new dependency
      dependencies.set(moduleSpecifier, {
        id: uuidv4(),
        name: moduleSpecifier,
        type: dependencyType,
        importCount: 1,
        importedSymbols: new Map(importedSymbols.map(s => [s, 1])),
        importingFiles: new Set([sourceFilePath]),
        confidence: importStmt.confidence
      });
    } else {
      // Update existing dependency
      const dep = dependencies.get(moduleSpecifier)!;
      dep.importCount++;
      dep.importingFiles.add(sourceFilePath);
      
      // Update imported symbols counts
      for (const symbol of importedSymbols) {
        const current = dep.importedSymbols.get(symbol) || 0;
        dep.importedSymbols.set(symbol, current + 1);
      }
      
      // Average the confidence
      dep.confidence = (dep.confidence + importStmt.confidence) / 2;
    }
  }
  
  /**
   * Enrich dependency understanding by using relationships and patterns
   * @private
   */
  private async enrichDependencyUnderstanding(
    understanding: CodebaseUnderstanding,
    imports: ImportStatement[],
    exports: ExportStatement[],
    dependencies: Map<string, Dependency>
  ): Promise<void> {
    // Analyze the relationships in the codebase
    const importRelationships = understanding.relationships.filter(
      rel => rel.type === RelationshipType.IMPORTS || rel.type === RelationshipType.DEPENDS_ON
    );
    
    // Match relationships to imports
    for (const rel of importRelationships) {
      const sourceNode = understanding.codeNodes.get(rel.sourceId);
      const targetNode = understanding.codeNodes.get(rel.targetId);
      
      if (!sourceNode || !targetNode) continue;
      
      // Find import statements for this file
      const fileImports = imports.filter(imp => imp.sourceFilePath === sourceNode.path);
      
      // See if any imports might correspond to the target
      for (const imp of fileImports) {
        // Already resolved, skip
        if (imp.resolvedPath) continue;
        
        if (this.mightBeRelated(imp.moduleSpecifier, targetNode.path, understanding.rootPath)) {
          // Set the resolved path with moderate confidence
          imp.resolvedPath = targetNode.path;
          imp.confidence = Math.min(imp.confidence, rel.confidence);
        }
      }
    }
    
    // Try to resolve local imports to actual files
    await this.resolveLocalImports(understanding, imports, dependencies);
    
    // Try to infer dependency information from package.json if available
    await this.inferDependencyInfo(understanding, dependencies);
    
    // Categorize dependencies based on import patterns
    this.categorizeDependencies(understanding, dependencies);
  }
  
  /**
   * Try to resolve local imports to actual file paths
   * @private
   */
  private async resolveLocalImports(
    understanding: CodebaseUnderstanding,
    imports: ImportStatement[],
    dependencies: Map<string, Dependency>
  ): Promise<void> {
    const rootDir = understanding.rootPath;
    
    // Create a map of all files for efficient lookup
    const allFiles = new Map<string, FileNode>();
    const collectFiles = (dir: DirectoryNode, parentPath = '') => {
      for (const child of dir.children) {
        if ('extension' in child) {
          allFiles.set(child.path, child);
          
          // Also map shorter paths for imports
          const relativePath = path.relative(rootDir, child.path);
          allFiles.set(relativePath, child);
          
          // Handle index files specially
          if (path.basename(child.path) === 'index.js' || 
              path.basename(child.path) === 'index.ts' ||
              path.basename(child.path) === 'index.jsx' ||
              path.basename(child.path) === 'index.tsx') {
            const dirPath = path.dirname(child.path);
            const dirRelativePath = path.relative(rootDir, dirPath);
            allFiles.set(dirRelativePath, child);
          }
        } else {
          collectFiles(child, path.join(parentPath, child.name));
        }
      }
    };
    
    collectFiles(understanding.fileSystem.root);
    
    // Process each import statement
    for (const importStmt of imports) {
      // Skip if already resolved or not local
      if (importStmt.resolvedPath || importStmt.dependencyType !== DependencyType.LOCAL_FILE) {
        continue;
      }
      
      const { moduleSpecifier, sourceFilePath } = importStmt;
      const sourceDirPath = path.dirname(sourceFilePath);
      
      // Handle relative paths
      if (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../')) {
        const absolutePath = path.resolve(sourceDirPath, moduleSpecifier);
        
        // Try exact match first
        if (allFiles.has(absolutePath)) {
          importStmt.resolvedPath = allFiles.get(absolutePath)!.path;
          continue;
        }
        
        // Try adding extensions
        for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
          const pathWithExt = absolutePath + ext;
          if (allFiles.has(pathWithExt)) {
            importStmt.resolvedPath = allFiles.get(pathWithExt)!.path;
            break;
          }
        }
        
        // Try as directory with index file
        if (!importStmt.resolvedPath) {
          for (const indexFile of ['index.js', 'index.jsx', 'index.ts', 'index.tsx']) {
            const indexPath = path.join(absolutePath, indexFile);
            if (allFiles.has(indexPath)) {
              importStmt.resolvedPath = allFiles.get(indexPath)!.path;
              break;
            }
          }
        }
      }
      // Handle absolute paths or module paths without ./ or ../
      else if (!moduleSpecifier.includes(':')) {
        // Could be an absolute path from project root
        const absolutePath = path.join(rootDir, moduleSpecifier);
        
        // Try exact match first
        if (allFiles.has(absolutePath)) {
          importStmt.resolvedPath = allFiles.get(absolutePath)!.path;
          continue;
        }
        
        // Try adding extensions
        for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
          const pathWithExt = absolutePath + ext;
          if (allFiles.has(pathWithExt)) {
            importStmt.resolvedPath = allFiles.get(pathWithExt)!.path;
            break;
          }
        }
        
        // If not found, it might be an external module or a root-relative path
        if (!importStmt.resolvedPath) {
          // Check if it could be a root-relative module path
          if (allFiles.has(moduleSpecifier)) {
            importStmt.resolvedPath = allFiles.get(moduleSpecifier)!.path;
          } 
          // Or try with extensions
          else {
            for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
              const pathWithExt = moduleSpecifier + ext;
              if (allFiles.has(pathWithExt)) {
                importStmt.resolvedPath = allFiles.get(pathWithExt)!.path;
                break;
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * Try to infer dependency information from package.json if available
   * @private
   */
  private async inferDependencyInfo(
    understanding: CodebaseUnderstanding,
    dependencies: Map<string, Dependency>
  ): Promise<void> {
    const rootDir = understanding.rootPath;
    const packageJsonPath = path.join(rootDir, 'package.json');
    
    try {
      const packageJsonContent = await this.fileSystem.readFile(packageJsonPath);
      if (!packageJsonContent.content) return;
      
      const packageJson = JSON.parse(packageJsonContent.content);
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      };
      
      // Update dependency information
      for (const [moduleSpecifier, dependency] of dependencies.entries()) {
        if (dependency.type === DependencyType.EXTERNAL_PACKAGE) {
          const packageName = this.getPackageNameFromSpecifier(moduleSpecifier);
          
          if (packageName in allDeps) {
            dependency.version = allDeps[packageName];
            dependency.confidence = Math.max(dependency.confidence, 0.9); // Higher confidence if found in package.json
          }
        }
      }
    } catch (error) {
      console.warn('Could not read or parse package.json');
    }
  }
  
  /**
   * Categorize dependencies based on import patterns
   * @private
   */
  private categorizeDependencies(
    understanding: CodebaseUnderstanding,
    dependencies: Map<string, Dependency>
  ): void {
    // Extract some statistics to improve categorization
    const importCounts = new Map<string, number>();
    const resolvedLocalFiles = new Set<string>();
    
    for (const [moduleSpecifier, dependency] of dependencies.entries()) {
      importCounts.set(moduleSpecifier, dependency.importCount);
      
      // Track resolved local files
      if (dependency.type === DependencyType.LOCAL_FILE && understanding.dependencies?.imports) {
        for (const imp of understanding.dependencies.imports) {
          if (imp.moduleSpecifier === moduleSpecifier && imp.resolvedPath) {
            resolvedLocalFiles.add(moduleSpecifier);
            break;
          }
        }
      }
    }
    
    // Calculate import frequency statistics
    const importValues = Array.from(importCounts.values());
    const maxImports = Math.max(...importValues);
    const avgImports = importValues.reduce((a, b) => a + b, 0) / importValues.length;
    
    // Find root-level directories
    const rootDirs = understanding.fileSystem.root.children
      .filter(child => !('extension' in child))
      .map(child => child.name.toLowerCase());
    
    // Re-evaluate dependency types
    for (const [moduleSpecifier, dependency] of dependencies.entries()) {
      // Skip already resolved local files
      if (resolvedLocalFiles.has(moduleSpecifier)) {
        continue;
      }
      
      // Evaluate potentially internal modules
      if (dependency.type === DependencyType.EXTERNAL_PACKAGE) {
        const importCount = dependency.importCount;
        const moduleParts = moduleSpecifier.split('/');
        const rootModule = moduleParts[0].toLowerCase();
        
        // Check if it matches a root directory and is heavily used
        if (rootDirs.includes(rootModule) && importCount > avgImports) {
          dependency.type = DependencyType.INTERNAL_MODULE;
          dependency.confidence = 0.8;
        }
        
        // Check for core language constructs based on usage patterns
        if (importCount > maxImports * 0.7 && moduleParts.length === 1) {
          dependency.type = DependencyType.LANGUAGE_CORE;
          dependency.confidence = 0.85;
        }
      }
    }
  }
  
  /**
   * Selects a representative sample of files to analyze for pattern discovery
   * @private
   */
  private async selectRepresentativeSample(understanding: CodebaseUnderstanding): Promise<Array<{path: string, content: string}>> {
    const result: Array<{path: string, content: string}> = [];
    const maxSampleSize = 50; // Limit sample size for performance
    const filesByExt = new Map<string, FileNode[]>();
    
    // Group files by extension
    const collectFiles = (dir: DirectoryNode) => {
      for (const child of dir.children) {
        if ('extension' in child) {
          // Skip very large files and binary files
          if (child.size > 1024 * 1024) { // > 1MB
            continue;
          }
          
          const ext = child.extension || '';
          if (!filesByExt.has(ext)) {
            filesByExt.set(ext, []);
          }
          filesByExt.get(ext)!.push(child);
        } else {
          collectFiles(child);
        }
      }
    };
    
    collectFiles(understanding.fileSystem.root);
    
    // Take a representative sample from each extension group
    for (const [ext, files] of filesByExt.entries()) {
      // Skip extensions with too few files
      if (files.length < 3) continue;
      
      // Calculate sample size based on group size
      const sampleSize = Math.min(
        Math.max(3, Math.ceil(files.length * 0.1)), // 10% of files, at least 3
        Math.ceil(maxSampleSize * (files.length / understanding.fileSystem.fileCount))
      );
      
      // Randomly select files
      const shuffled = [...files].sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(0, sampleSize);
      
      // Read content of sampled files
      for (const file of sample) {
        try {
          let content: string;
          if (typeof file.content === 'string') {
            content = file.content;
          } else if (file.content && typeof file.content === 'object' && 'reference' in file.content) {
            const fileContent = await this.fileSystem.readFile(file.path);
            content = fileContent.content || '';
          } else {
            continue;
          }
          
          result.push({
            path: file.path,
            content
          });
        } catch (error) {
          console.error(`Error reading file ${file.path}:`, error);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Consolidate similar patterns to reduce redundancy
   * @private
   */
  private consolidatePatterns(): void {
    // This is a simplified version - in a real implementation,
    // we would need more sophisticated pattern comparison and merging
    
    // For now, just remove exact duplicates
    const uniqueImportPatterns = new Map<string, RegExp>();
    const uniqueExportPatterns = new Map<string, RegExp>();
    
    for (const [id, pattern] of this.importPatterns.entries()) {
      const patternStr = pattern.toString();
      let isDuplicate = false;
      
      for (const [existingId, existingPattern] of uniqueImportPatterns.entries()) {
        if (existingPattern.toString() === patternStr) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueImportPatterns.set(id, pattern);
      }
    }
    
    for (const [id, pattern] of this.exportPatterns.entries()) {
      const patternStr = pattern.toString();
      let isDuplicate = false;
      
      for (const [existingId, existingPattern] of uniqueExportPatterns.entries()) {
        if (existingPattern.toString() === patternStr) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueExportPatterns.set(id, pattern);
      }
    }
    
    this.importPatterns = uniqueImportPatterns;
    this.exportPatterns = uniqueExportPatterns;
  }
  
  // Utility methods
  
  /**
   * Get a node ID for a file path
   * @private
   */
  private getNodeIdForPath(understanding: CodebaseUnderstanding, filePath: string): string {
    // Look up the node ID from the codeNodes map
    for (const [id, node] of understanding.codeNodes.entries()) {
      if (node.path === filePath) {
        return id;
      }
    }
    
    // If not found, return the file path itself
    return filePath;
  }
  
  /**
   * Get the line number for a position in text
   * @private
   */
  private getLineNumber(content: string, position: number): number {
    // Count newlines before the position
    const textBefore = content.substring(0, position);
    return (textBefore.match(/\n/g) || []).length + 1;
  }
  
  /**
   * Check if two paths might be related
   * @private
   */
  private mightBeRelated(moduleSpecifier: string, targetPath: string, rootPath: string): boolean {
    // Basic check for module name matching filename
    const targetName = path.basename(targetPath, path.extname(targetPath));
    if (moduleSpecifier === targetName) return true;
    
    // Check for path similarity
    const relativePath = path.relative(rootPath, targetPath);
    return relativePath.includes(moduleSpecifier) || moduleSpecifier.includes(relativePath);
  }
  
  /**
   * Extract the package name from a module specifier path
   * @private
   */
  private getPackageNameFromSpecifier(moduleSpecifier: string): string {
    // Handle scoped packages like @org/package
    if (moduleSpecifier.startsWith('@')) {
      const parts = moduleSpecifier.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }
    
    // Handle normal packages, possibly with subpaths like 'lodash/map'
    return moduleSpecifier.split('/')[0];
  }
  
  /**
   * Check if a module is likely a standard library
   * Based on heuristics rather than hardcoded lists
   * @private
   */
  private isLikelyStandardLibrary(moduleSpecifier: string): boolean {
    // This is a heuristic - in a full implementation we might
    // discover these through analyzing patterns in the codebase
    
    // Common built-in modules across languages tend to:
    // 1. Be single-word or short names
    // 2. Not contain dashes or special characters
    // 3. Be imported widely across many files
    // 4. Not be in package.json
    
    // For now, we'll use a simple check
    const isSimpleName = !/[-@]/.test(moduleSpecifier);
    const isShortName = moduleSpecifier.length < 10;
    const noPath = !moduleSpecifier.includes('/');
    
    return isSimpleName && isShortName && noPath;
  }
}