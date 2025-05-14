/**
 * Pattern Analyzer
 *
 * Discovers recurring patterns in the codebase.
 * Implements the EmergentAnalyzer interface.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  EmergentAnalyzer,
  FileNode, 
  CodeNode,
  CodePattern,
  PatternDefinition,
  PatternInstance
} from '../unifiedTypes.js';
import { SharedAnalysisContext } from '../sharedAnalysisContext.js';

/**
 * Pattern analyzer for discovering patterns in code
 */
export class PatternAnalyzer implements EmergentAnalyzer {
  // Core analyzer properties
  readonly id: string = 'pattern-analyzer';
  readonly name: string = 'Pattern Analyzer';
  readonly priority: number = 30; // Medium priority
  readonly dependencies: string[] = ['language-detector']; // Depends on language detection
  
  // Pattern discovery state
  private nodesByType: Record<string, CodeNode[]> = {};
  private nameCounts: Record<string, number> = {};
  private casingCounts = {
    camelCase: 0,
    PascalCase: 0,
    snake_case: 0,
    kebab_case: 0,
    ALL_CAPS: 0,
  };
  private prefixCounts: Record<string, number> = {};
  private suffixCounts: Record<string, number> = {};
  private totalNodesProcessed: number = 0;
  
  /**
   * Initialize the analyzer
   */
  async initialize(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Initializing...`);
    
    // Reset state
    this.nodesByType = {};
    this.nameCounts = {};
    this.casingCounts = {
      camelCase: 0,
      PascalCase: 0,
      snake_case: 0,
      kebab_case: 0,
      ALL_CAPS: 0,
    };
    this.prefixCounts = {};
    this.suffixCounts = {};
    this.totalNodesProcessed = 0;
    
    // Register basic pattern definitions for other analyzers to use
    this.registerCommonPatterns(context);
  }
  
  /**
   * Register common code patterns for shared use
   */
  private registerCommonPatterns(context: SharedAnalysisContext): void {
    // Register common naming patterns
    context.registerPattern({
      type: 'naming_convention',
      name: 'camelCase',
      regex: '^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$',
      description: 'camelCase naming convention',
      confidence: 0.9
    });
    
    context.registerPattern({
      type: 'naming_convention',
      name: 'PascalCase',
      regex: '^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$',
      description: 'PascalCase naming convention',
      confidence: 0.9
    });
    
    context.registerPattern({
      type: 'naming_convention',
      name: 'snake_case',
      regex: '^[a-z][a-z0-9]*(_[a-z0-9]+)*$',
      description: 'snake_case naming convention',
      confidence: 0.9
    });
    
    context.registerPattern({
      type: 'naming_convention',
      name: 'kebab-case',
      regex: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
      description: 'kebab-case naming convention',
      confidence: 0.9
    });
    
    context.registerPattern({
      type: 'naming_convention',
      name: 'CONSTANT_CASE',
      regex: '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$',
      description: 'CONSTANT_CASE naming convention',
      confidence: 0.9
    });
    
    // Register common structure patterns
    context.registerPattern({
      type: 'structure',
      name: 'Controller class',
      regex: 'class\\s+([A-Z][a-zA-Z0-9]*Controller)\\b',
      description: 'Controller class pattern often found in MVC architectures',
      confidence: 0.85,
      metadata: {
        category: 'architecture',
        pattern: 'mvc'
      }
    });
    
    context.registerPattern({
      type: 'structure',
      name: 'Service class',
      regex: 'class\\s+([A-Z][a-zA-Z0-9]*Service)\\b',
      description: 'Service class pattern often found in service-oriented architectures',
      confidence: 0.85,
      metadata: {
        category: 'architecture',
        pattern: 'service-oriented'
      }
    });
    
    context.registerPattern({
      type: 'structure',
      name: 'Factory pattern',
      regex: 'class\\s+([A-Z][a-zA-Z0-9]*Factory)\\b',
      description: 'Factory design pattern',
      confidence: 0.8,
      metadata: {
        category: 'design_pattern',
        pattern: 'factory'
      }
    });
  }
  
  /**
   * Called for each file during the content analysis phase
   */
  async analyzeFile(file: FileNode, content: string, context: SharedAnalysisContext): Promise<void> {
    // During file analysis, we collect nodes from the context and start basic pattern matching
    // Most pattern analysis happens after all files are processed
    
    // Skip files without language
    if (!file.languageType) {
      return;
    }
    
    // Look for patterns in the content
    await this.analyzeCodePatterns(file, content, context);
    
    // Collect nodes for later pattern analysis
    for (const node of context.codeNodes.values()) {
      if (node.path === file.path) {
        // Group node by type
        if (!this.nodesByType[node.type]) {
          this.nodesByType[node.type] = [];
        }
        this.nodesByType[node.type].push(node);
        
        // Analyze naming conventions
        this.analyzeNamingConvention(node);
        
        this.totalNodesProcessed++;
      }
    }
  }
  
  /**
   * Analyze code patterns in a file
   */
  private async analyzeCodePatterns(file: FileNode, content: string, context: SharedAnalysisContext): Promise<void> {
    // Apply registered patterns to the content
    const structurePatterns = context.findMatchingPatterns(content, 'structure');
    
    // If patterns are found, record as metadata for the file
    if (structurePatterns.length > 0) {
      file.metadata = file.metadata || {};
      file.metadata.patterns = structurePatterns.map(p => ({
        patternId: p.patternId,
        match: p.match,
        confidence: p.confidence
      }));
    }
    
    // Language-specific pattern analysis would go here
    // Different language analyzers handle the details
  }
  
  /**
   * Analyze naming conventions of a code node
   */
  private analyzeNamingConvention(node: CodeNode): void {
    const name = node.name;
    
    // Skip empty names or single-character names
    if (!name || name.length <= 1) return;
    
    // Count name occurrences
    this.nameCounts[name] = (this.nameCounts[name] || 0) + 1;
    
    // Check casing style
    if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
      this.casingCounts.PascalCase++;
    } else if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
      this.casingCounts.camelCase++;
    } else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) {
      this.casingCounts.snake_case++;
    } else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
      this.casingCounts.kebab_case++;
    } else if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name)) {
      this.casingCounts.ALL_CAPS++;
    }
    
    // Check for common prefixes (3 chars or more)
    for (let i = 3; i <= Math.min(name.length / 2, 5); i++) {
      const prefix = name.substring(0, i);
      this.prefixCounts[prefix] = (this.prefixCounts[prefix] || 0) + 1;
    }
    
    // Check for common suffixes (3 chars or more)
    for (let i = 3; i <= Math.min(name.length / 2, 5); i++) {
      const suffix = name.substring(name.length - i);
      this.suffixCounts[suffix] = (this.suffixCounts[suffix] || 0) + 1;
    }
  }
  
  /**
   * Called after all files have been processed
   */
  async processRelationships(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Processing relationships between patterns...`);
    
    // At this point, we can look for relationships between patterns
    // For now, we'll focus on building the patterns in the pattern discovery phase
    // but in a full implementation, we could add pattern relationship analysis here
  }
  
  /**
   * Called to discover and refine patterns
   */
  async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Discovering code patterns...`);
    
    const patterns: CodePattern[] = [];
    
    // Discover structural patterns
    patterns.push(...await this.discoverStructuralPatterns(context));
    
    // Discover naming convention patterns
    patterns.push(...await this.discoverNamingPatterns(context));
    
    // Discover file organization patterns
    patterns.push(...await this.discoverFileOrganizationPatterns(context));
    
    // Add the patterns to the shared context
    for (const pattern of patterns) {
      context.patterns.push(pattern);
    }
    
    console.log(`[${this.name}] Discovered ${patterns.length} patterns`);
  }
  
  /**
   * Discover structural patterns
   */
  private async discoverStructuralPatterns(context: SharedAnalysisContext): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];
    
    // For each type, try to find common structures
    for (const [type, nodes] of Object.entries(this.nodesByType)) {
      if (nodes.length < 3) continue; // Need at least 3 instances to establish a pattern
      
      // Create a basic structural pattern
      const structurePattern: CodePattern = {
        id: uuidv4(),
        type: 'structural',
        name: `${type} structure`,
        description: `Common structure for ${type} elements`,
        signature: {
          nodeType: type,
          minSize: 0,
          maxSize: 0,
          properties: [],
        },
        instances: [],
        confidence: 0.6,
        frequency: nodes.length,
        importance: 0.5,
      };
      
      // Add instances
      for (const node of nodes) {
        structurePattern.instances.push({
          nodeId: node.id,
          nodePath: node.path,
          matchScore: 1.0,
          metadata: {},
        });
      }
      
      patterns.push(structurePattern);
    }
    
    return patterns;
  }
  
  /**
   * Discover naming convention patterns
   */
  private async discoverNamingPatterns(context: SharedAnalysisContext): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];
    
    // Find dominant casing style
    let dominantStyle = '';
    let maxCount = 0;
    
    for (const [style, count] of Object.entries(this.casingCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantStyle = style;
      }
    }
    
    // Create a pattern if there's a clear dominant style
    if (maxCount > 0 && maxCount / this.totalNodesProcessed > 0.3) {
      const casingPattern: CodePattern = {
        id: uuidv4(),
        type: 'naming',
        name: `${dominantStyle} convention`,
        description: `Names predominantly use ${dominantStyle} convention`,
        signature: {
          style: dominantStyle,
          regex: this.getCasingStyleRegex(dominantStyle),
        },
        instances: [],
        confidence: maxCount / this.totalNodesProcessed,
        frequency: maxCount,
        importance: 0.7,
      };
      
      // Add instances from context
      for (const node of context.codeNodes.values()) {
        if (this.matchesCasingStyle(node.name, dominantStyle)) {
          casingPattern.instances.push({
            nodeId: node.id,
            nodePath: node.path,
            matchScore: 1.0,
            metadata: {},
          });
        }
      }
      
      patterns.push(casingPattern);
    }
    
    // Find significant prefixes and suffixes (used in at least 10% of names)
    const significanceThreshold = Math.max(3, this.totalNodesProcessed * 0.1);
    
    // Add prefix patterns
    for (const [prefix, count] of Object.entries(this.prefixCounts)) {
      if (count >= significanceThreshold) {
        const prefixPattern: CodePattern = {
          id: uuidv4(),
          type: 'naming',
          name: `${prefix}* prefix convention`,
          description: `Names commonly start with "${prefix}"`,
          signature: {
            type: 'prefix',
            value: prefix,
          },
          instances: [],
          confidence: count / this.totalNodesProcessed,
          frequency: count,
          importance: 0.6,
        };
        
        // Add instances
        for (const node of context.codeNodes.values()) {
          if (node.name.startsWith(prefix)) {
            prefixPattern.instances.push({
              nodeId: node.id,
              nodePath: node.path,
              matchScore: 1.0,
              metadata: {},
            });
          }
        }
        
        patterns.push(prefixPattern);
      }
    }
    
    // Add suffix patterns
    for (const [suffix, count] of Object.entries(this.suffixCounts)) {
      if (count >= significanceThreshold) {
        const suffixPattern: CodePattern = {
          id: uuidv4(),
          type: 'naming',
          name: `*${suffix} suffix convention`,
          description: `Names commonly end with "${suffix}"`,
          signature: {
            type: 'suffix',
            value: suffix,
          },
          instances: [],
          confidence: count / this.totalNodesProcessed,
          frequency: count,
          importance: 0.6,
        };
        
        // Add instances
        for (const node of context.codeNodes.values()) {
          if (node.name.endsWith(suffix)) {
            suffixPattern.instances.push({
              nodeId: node.id,
              nodePath: node.path,
              matchScore: 1.0,
              metadata: {},
            });
          }
        }
        
        patterns.push(suffixPattern);
      }
    }
    
    return patterns;
  }
  
  /**
   * Discover file organization patterns
   */
  private async discoverFileOrganizationPatterns(context: SharedAnalysisContext): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];
    
    // Analyze file organization by looking at directory structures
    const fileSystem = context.fileSystem;
    const directories = this.getDirectories(fileSystem.root);
    
    // Extract directory names
    const dirNames = directories.map(dir => dir.name);
    
    // Count occurrences of common directory names
    const commonDirNames = [
      'src',
      'source',
      'lib',
      'app',
      'components',
      'utils',
      'helpers',
      'services',
      'models',
      'views',
      'controllers',
      'config',
      'docs',
      'test',
      'tests',
      'specs',
      '__tests__',
      'public',
      'static',
      'assets',
      'images',
      'styles',
      'css',
    ];
    
    const dirNameCounts: Record<string, number> = {};
    for (const name of commonDirNames) {
      const count = dirNames.filter(
        n => n.toLowerCase() === name.toLowerCase(),
      ).length;
      if (count > 0) {
        dirNameCounts[name] = count;
      }
    }
    
    // Create patterns for common directory structures
    // Look for feature-based organization (directories named after features)
    const featureBasedDirs = directories.filter(dir => {
      // Exclude common utility/infrastructure directories
      const name = dir.name.toLowerCase();
      return (
        !commonDirNames.includes(name) &&
        dir.children.length > 1 &&
        dir.children.some((c: any) => 'children' in c)
      );
    });
    
    if (featureBasedDirs.length >= 3) {
      // This might be a feature-based organization
      const featurePattern: CodePattern = {
        id: uuidv4(),
        type: 'organization',
        name: 'Feature-based organization',
        description:
          'Code is organized by feature/domain rather than technical concerns',
        signature: {
          type: 'directory_structure',
          feature_based: true,
        },
        instances: featureBasedDirs.map(dir => ({
          nodeId: `dir:${dir.path}`,
          nodePath: dir.path,
          matchScore: 1.0,
          metadata: {
            childCount: dir.children.length,
          },
        })),
        confidence: 0.7,
        frequency: featureBasedDirs.length,
        importance: 0.8,
      };
      
      patterns.push(featurePattern);
    }
    
    // Check for technical separation (e.g., MVC pattern)
    const mvcPattern = ['models', 'views', 'controllers'].every(dir =>
      dirNames.some(name => name.toLowerCase() === dir),
    );
    
    if (mvcPattern) {
      patterns.push({
        id: uuidv4(),
        type: 'organization',
        name: 'MVC pattern',
        description: 'Code follows Model-View-Controller architectural pattern',
        signature: {
          type: 'directory_structure',
          pattern: 'mvc',
        },
        instances: directories
          .filter(dir =>
            ['models', 'views', 'controllers'].includes(dir.name.toLowerCase()),
          )
          .map(dir => ({
            nodeId: `dir:${dir.path}`,
            nodePath: dir.path,
            matchScore: 1.0,
            metadata: {},
          })),
        confidence: 0.9,
        frequency: 3,
        importance: 0.9,
      });
    }
    
    return patterns;
  }
  
  /**
   * Final integration phase
   */
  async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
    console.log(`[${this.name}] Integrating pattern analysis...`);
    
    // Record metrics
    context.recordMetric('total_patterns', context.patterns.length);
    
    // Group patterns by type
    const patternsByType: Record<string, number> = {};
    for (const pattern of context.patterns) {
      patternsByType[pattern.type] = (patternsByType[pattern.type] || 0) + 1;
    }
    
    // Record pattern type metrics
    for (const [type, count] of Object.entries(patternsByType)) {
      context.recordMetric(`patterns_${type}`, count);
    }
    
    // In a more advanced implementation, we could add additional insights here
    // Such as pattern correlations, pattern hierarchies, etc.
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Reset state
    this.nodesByType = {};
    this.nameCounts = {};
    this.casingCounts = {
      camelCase: 0,
      PascalCase: 0,
      snake_case: 0,
      kebab_case: 0,
      ALL_CAPS: 0,
    };
    this.prefixCounts = {};
    this.suffixCounts = {};
    this.totalNodesProcessed = 0;
  }
  
  // Helper methods
  
  /**
   * Get all directories from the file system tree
   * @private
   */
  private getDirectories(root: any): any[] {
    const dirs: any[] = [];
    
    const traverse = (node: any) => {
      if (!('extension' in node) && 'children' in node) {
        dirs.push(node);
        
        for (const child of node.children) {
          if (!('extension' in child) && 'children' in child) {
            traverse(child);
          }
        }
      }
    };
    
    traverse(root);
    return dirs;
  }
  
  /**
   * Check if a name matches a casing style
   * @private
   */
  private matchesCasingStyle(name: string, style: string): boolean {
    switch (style) {
      case 'camelCase':
        return /^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name);
      case 'PascalCase':
        return /^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name);
      case 'snake_case':
        return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name);
      case 'kebab_case':
        return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
      case 'ALL_CAPS':
        return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name);
      default:
        return false;
    }
  }
  
  /**
   * Get a regex for a casing style
   * @private
   */
  private getCasingStyleRegex(style: string): string {
    switch (style) {
      case 'camelCase':
        return '^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$';
      case 'PascalCase':
        return '^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$';
      case 'snake_case':
        return '^[a-z][a-z0-9]*(_[a-z0-9]+)*$';
      case 'kebab_case':
        return '^[a-z][a-z0-9]*(-[a-z0-9]+)*$';
      case 'ALL_CAPS':
        return '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$';
      default:
        return '.*';
    }
  }
}