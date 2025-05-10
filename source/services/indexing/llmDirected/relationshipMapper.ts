// source/services/indexing/llmDirected/relationshipMapper.ts

import { CodeSymbol, CodeDependency } from '../types.js';

/**
 * Interface for defining relationship patterns
 * 
 * This interface is intentionally flexible to allow the LLM to define any type
 * of relationship pattern it deems appropriate for the codebase being analyzed.
 */
export interface RelationshipPattern {
  // The type of relationship - can be any string the LLM decides is appropriate
  type: string;
  
  // Types of symbols that can be the source of this relationship
  sourceType?: string[];
  
  // Types of symbols that can be the target of this relationship
  targetType?: string[];
  
  // Pattern-specific detection configuration
  // The contents are entirely up to the LLM - our code will handle whatever is provided
  detection: {
    [key: string]: any;
  };
  
  // Optional rules for refining/filtering detected relationships
  // Again, the contents are defined by the LLM based on what it thinks is best
  refinement?: {
    [key: string]: any;
  };
  
  // Allow for any additional properties the LLM might want to define
  [key: string]: any;
}

/**
 * The RelationshipMapper class is responsible for mapping relationships between symbols
 * based on patterns defined by the LLM.
 */
export class RelationshipMapper {
  /**
   * Maps relationships between symbols using the provided patterns
   * Designed for maximum flexibility and schema-freedom
   */
  async mapRelationships(
    symbols: CodeSymbol[],
    patterns: RelationshipPattern[],
    existingDependencies: CodeDependency[] = []
  ): Promise<CodeDependency[]> {
    try {
      console.log(`Mapping relationships between ${symbols.length} symbols using ${patterns.length} patterns`);

      // Start with existing dependencies
      const relationships: CodeDependency[] = [...existingDependencies];

      // First, validate symbols to ensure they have minimal required properties
      // This avoids errors while still allowing any structure the LLM wants to use
      const validatedSymbols = symbols.map(symbol => {
        // Ensure we have at least a name for the symbol
        if (!symbol.name) {
          console.warn('Symbol missing name property, generating a placeholder name');
          symbol.name = `unnamed_symbol_${Math.random().toString(36).substring(2, 9)}`;
        }

        // Handle missing location information without imposing structure
        if (!symbol.location) {
          console.warn(`Symbol ${symbol.name} missing location, creating minimal location object`);
          symbol.location = { filePath: '', startLine: 1, endLine: 1, startColumn: 1, endColumn: 1 };
        } else {
          // Ensure the filePath property exists since it's often used in relationship mapping
          if (!symbol.location.filePath) {
            console.warn(`Symbol ${symbol.name} missing location.filePath`);
            symbol.location.filePath = '';
          }
        }

        return symbol;
      });

      // Apply each pattern to detect relationships, allowing for pattern evolution
      for (const pattern of patterns) {
        try {
          // Handle patterns with missing fields gracefully
          if (!pattern.type) {
            console.warn('Pattern missing type property, skipping');
            continue;
          }

          const detectedRelationships = await this.detectRelationships(validatedSymbols, pattern);
          relationships.push(...detectedRelationships);

          // Log pattern effectiveness for continuous learning
          console.log(`Pattern '${pattern.type}' detected ${detectedRelationships.length} relationships`);
        } catch (error) {
          console.error(`Error applying relationship pattern ${pattern.type}:`, error);
        }
      }

      // Remove duplicates (same source, target, and type)
      return this.deduplicateRelationships(relationships);
    } catch (error) {
      console.error('Error mapping relationships:', error);
      return existingDependencies;
    }
  }
  
  /**
   * Removes duplicate relationships from the list
   */
  private deduplicateRelationships(relationships: CodeDependency[]): CodeDependency[] {
    const seen = new Set<string>();
    return relationships.filter(rel => {
      const key = `${rel.source}:${rel.target}:${rel.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Detects relationships between symbols using a specific pattern
   */
  private async detectRelationships(
    symbols: CodeSymbol[],
    pattern: RelationshipPattern
  ): Promise<CodeDependency[]> {
    // First try to use the detection method specified in the pattern
    if (pattern.detection && pattern.detection['method']) {
      // The LLM can specify its own detection method
      const method = pattern.detection['method'];

      // If LLM specifies a method we have implemented, use it
      if (method === 'import' || method === 'import-based') {
        return this.detectImportRelationships(symbols, pattern);
      }

      if (method === 'inheritance' || method === 'extends-based') {
        return this.detectInheritanceRelationships(symbols, pattern);
      }

      if (method === 'call' || method === 'usage-based') {
        return this.detectUsageRelationships(symbols, pattern);
      }

      if (method === 'containment' || method === 'parent-child') {
        return this.detectContainmentRelationships(symbols, pattern);
      }
    }

    // If no method specified or no matching implementation, use the generic approach
    // that can handle any type of relationship pattern
    return this.detectGenericRelationships(symbols, pattern);
  }
  
  /**
   * Detects import relationships between symbols
   */
  private detectImportRelationships(
    symbols: CodeSymbol[],
    pattern: RelationshipPattern
  ): CodeDependency[] {
    const relationships: CodeDependency[] = [];
    
    // Get the import pattern details from the detection config
    const importPattern = pattern.detection['pattern'] || '(?:import|require)[\\s\\(]*[\'"]([^\'"]+)[\'"]';
    
    // For each symbol, check if it imports other symbols
    for (const source of symbols) {
      // Skip non-module symbols
      if (!source.content) continue;
      
      // Look for import statements in the symbol content
      try {
        const regex = new RegExp(importPattern, 'g');
        let match;
        while ((match = regex.exec(source.content)) !== null) {
          if (match[1]) {
            // Found an import target
            const importPath = match[1];
            
            // Look for a matching symbol by path or name
            const possibleTargets = symbols.filter(target => 
              // By file path suffix match
              target.location.filePath.endsWith(importPath + '.ts') || 
              target.location.filePath.endsWith(importPath + '.js') ||
              // By direct name match
              target.name === importPath
            );
            
            if (possibleTargets.length > 0) {
              // Add a relationship for each possible target
              for (const target of possibleTargets) {
                relationships.push({
                  source: source.name,
                  target: target.name,
                  type: pattern.type,
                  metadata: pattern["metadata"] || {}
                });
              }
            } else {
              // External dependency - create a virtual symbol if enabled
              if (pattern.detection['includeExternal']) {
                relationships.push({
                  source: source.name,
                  target: importPath,
                  type: pattern.type,
                  metadata: pattern["metadata"] || {}
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error detecting import relationships for ${source.name}:`, error);
      }
    }
    
    return relationships;
  }
  
  /**
   * Detects inheritance relationships between symbols
   */
  private detectInheritanceRelationships(
    symbols: CodeSymbol[],
    pattern: RelationshipPattern
  ): CodeDependency[] {
    const relationships: CodeDependency[] = [];
    
    // Get inheritance pattern from detection config
    const inheritsPattern = pattern.detection['pattern'] || 
                          '(?:extends|implements)\\s+([\\w\\.,\\s]+)';
    
    // Get source types that can inherit
    const sourceTypes = pattern.sourceType || ['class', 'interface'];
    
    // Filter symbols for potential sources (typically classes)
    const potentialSources = symbols.filter(symbol => 
      sourceTypes.includes(symbol.type) && symbol.content
    );
    
    // For each class or interface, check if it extends or implements others
    for (const source of potentialSources) {
      try {
        const regex = new RegExp(inheritsPattern, 'g');
        let match;
        
        while ((match = regex.exec(source.content || '')) !== null) {
          if (match[1]) {
            // Found an inheritance target
            const inheritsFrom = match[1].split(/\s*,\s*/); // Handle multiple inheritance
            
            for (const targetName of inheritsFrom) {
              // Clean up any type parameters e.g., "BaseClass<T>" -> "BaseClass"
              const cleanTargetName = targetName.replace(/<.*>/, '').trim();
              
              // Find matching target symbols
              const targets = symbols.filter(target => 
                target.name === cleanTargetName
              );
              
              if (targets.length > 0) {
                // Add relationships for each target
                for (const target of targets) {
                  relationships.push({
                    source: source.name,
                    target: target.name,
                    type: pattern.type,
                    metadata: pattern["metadata"] || {}
                  });
                }
              } else if (pattern.detection['includeExternal']) {
                // Include external inheritance
                relationships.push({
                  source: source.name,
                  target: cleanTargetName,
                  type: pattern.type,
                  metadata: pattern["metadata"] || {}
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error detecting inheritance for ${source.name}:`, error);
      }
    }
    
    return relationships;
  }
  
  /**
   * Detects usage/call relationships between symbols
   */
  private detectUsageRelationships(
    symbols: CodeSymbol[],
    pattern: RelationshipPattern
  ): CodeDependency[] {
    const relationships: CodeDependency[] = [];
    
    // Get source types (typically functions, methods, classes)
    const sourceTypes = pattern.sourceType || 
                      ['function', 'method', 'class', 'variable'];
    
    // Get target types (typically functions, methods, classes)
    const targetTypes = pattern.targetType || 
                      ['function', 'method', 'class', 'variable'];
    
    // For each potential source
    for (const source of symbols) {
      // Skip if not a source type
      if (!sourceTypes.includes(source.type) || !source.content) continue;
      
      // Check the content for usage of other symbols
      for (const target of symbols) {
        // Skip if same symbol or not a target type
        if (source.name === target.name || !targetTypes.includes(target.type)) continue;
        
        // Look for target name in source content
        // This is a simple approach - more sophisticated approaches would use AST traversal
        // or semantic analysis to confirm actual usage rather than just name mentions
        
        // Handle function/method calls
        if (target.type === 'function' || target.type === 'method') {
          const callPattern = new RegExp(`${target.name}\\s*\\(`, 'g');
          if (callPattern.test(source.content)) {
            relationships.push({
              source: source.name,
              target: target.name,
              type: pattern.type,
              metadata: pattern["metadata"] || {}
            });
          }
        } 
        // Handle class instantiation
        else if (target.type === 'class') {
          const newPattern = new RegExp(`new\\s+${target.name}\\s*\\(`, 'g');
          if (newPattern.test(source.content)) {
            relationships.push({
              source: source.name,
              target: target.name,
              type: pattern.type,
              metadata: pattern["metadata"] || {}
            });
          }
        } 
        // Handle variable usage
        else if (target.type === 'variable') {
          // More complex pattern to avoid partial matches
          const usePattern = new RegExp(`(^|[^\\w])${target.name}([^\\w]|$)`, 'g');
          if (usePattern.test(source.content)) {
            relationships.push({
              source: source.name,
              target: target.name,
              type: pattern.type,
              metadata: pattern["metadata"] || {}
            });
          }
        }
      }
    }
    
    return this.applyRefinements(relationships, pattern);
  }
  
  /**
   * Detects containment relationships (class -> methods, file -> functions, etc.)
   */
  private detectContainmentRelationships(
    symbols: CodeSymbol[],
    pattern: RelationshipPattern
  ): CodeDependency[] {
    const relationships: CodeDependency[] = [];
    
    // Get containment types from patterns
    const containerTypes = pattern.sourceType || ['class', 'interface', 'file'];
    const contentTypes = pattern.targetType || ['method', 'function', 'variable'];
    
    // Identify container symbols
    const containers = symbols.filter(symbol => 
      containerTypes.includes(symbol.type)
    );
    
    // For each container, check which symbols it contains
    for (const container of containers) {
      // For classes/interfaces, look for class members by parent property
      if (container.type === 'class' || container.type === 'interface') {
        // Find members referencing this container as parent
        const members = symbols.filter(symbol => 
          contentTypes.includes(symbol.type) && 
          symbol.parent === container.name
        );
        
        // Add containment relationships
        for (const member of members) {
          relationships.push({
            source: container.name,
            target: member.name,
            type: pattern.type,
            metadata: pattern["metadata"] || {}
          });
        }
      }
      // For files, look for symbols defined in the same file
      // TypeScript knows container.type can't be 'file', so we need a different condition
      else if (container.type === 'variable' && container.name.includes('file')) {
        // File symbols are virtual, we use the file path as the name
        const filePath = container.location.filePath;
        
        // Find all symbols defined in this file
        const fileSymbols = symbols.filter(symbol => 
          contentTypes.includes(symbol.type) && 
          symbol.location.filePath === filePath
        );
        
        // Add containment relationships
        for (const fileSymbol of fileSymbols) {
          relationships.push({
            source: container.name,
            target: fileSymbol.name,
            type: pattern.type,
            metadata: pattern["metadata"] || {}
          });
        }
      }
    }
    
    return relationships;
  }
  
  // We don't need any mapping function anymore since we accept any relationship type from the LLM

  /**
   * Detects generic relationships using pattern-specific configuration
   */
  private detectGenericRelationships(
    symbols: CodeSymbol[],
    pattern: RelationshipPattern
  ): CodeDependency[] {
    const relationships: CodeDependency[] = [];
    
    try {
      // Get key pattern details
      const sourceFilter = pattern.detection['sourceFilter'];
      const targetFilter = pattern.detection['targetFilter'];
      const contentPattern = pattern.detection['contentPattern'];
      
      if (!contentPattern) {
        console.warn('No content pattern defined for generic relationship detection');
        return relationships;
      }
      
      // Filter source symbols
      const sources = sourceFilter
        ? symbols.filter(symbol => {
            try {
              return new RegExp(sourceFilter).test(symbol.name);
            } catch (e) {
              return false;
            }
          })
        : symbols;
      
      // Filter target symbols
      const targets = targetFilter
        ? symbols.filter(symbol => {
            try {
              return new RegExp(targetFilter).test(symbol.name);
            } catch (e) {
              return false;
            }
          })
        : symbols;
      
      // For each source, check if it has relationship with any target
      for (const source of sources) {
        if (!source.content) continue;
        
        for (const target of targets) {
          if (source.name === target.name) continue;
          
          try {
            // Check for pattern in source content with target name
            const regex = new RegExp(
              contentPattern.replace('${targetName}', target.name),
              'g'
            );
            
            if (regex.test(source.content)) {
              // Use the original type from the pattern
              relationships.push({
                source: source.name,
                target: target.name,
                type: pattern.type,
                // Include any metadata provided in the pattern
                metadata: pattern["metadata"] || {}
              });
            }
          } catch (error) {
            console.error(`Error in generic relationship detection for ${source.name} -> ${target.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in generic relationship detection:', error);
    }
    
    return this.applyRefinements(relationships, pattern);
  }
  
  /**
   * Applies refinement rules to detected relationships
   */
  private applyRefinements(
    relationships: CodeDependency[],
    pattern: RelationshipPattern
  ): CodeDependency[] {
    if (!pattern.refinement) {
      return relationships;
    }
    
    let refined = [...relationships];
    
    // Apply source/target name pattern filtering
    if (pattern.refinement['excludeSourcePattern']) {
      const excludePattern = pattern.refinement['excludeSourcePattern'];
      refined = refined.filter(rel => {
        try {
          return !new RegExp(excludePattern).test(rel.source);
        } catch (e) {
          return true;
        }
      });
    }
    
    if (pattern.refinement['excludeTargetPattern']) {
      const excludePattern = pattern.refinement['excludeTargetPattern'];
      refined = refined.filter(rel => {
        try {
          return !new RegExp(excludePattern).test(rel.target);
        } catch (e) {
          return true;
        }
      });
    }
    
    // Apply maximum relationship count per source
    if (pattern.refinement['maxRelationshipsPerSource']) {
      const maxRel = pattern.refinement['maxRelationshipsPerSource'];
      
      // Group by source
      const bySource = new Map<string, CodeDependency[]>();
      for (const rel of refined) {
        if (!bySource.has(rel.source)) {
          bySource.set(rel.source, []);
        }
        bySource.get(rel.source)!.push(rel);
      }
      
      // Limit each source to max relationships
      refined = [];
      for (const [_, rels] of bySource.entries()) {
        refined.push(...rels.slice(0, maxRel));
      }
    }
    
    return refined;
  }
  
  /**
   * Generates a set of default relationship patterns for a codebase
   *
   * These patterns are just fallbacks and are not intended to constrain the LLM.
   * They only serve as a safety mechanism in case the LLM doesn't provide its own patterns.
   * Each pattern demonstrates a different detection approach that can be used.
   */
  generateDefaultPatterns(): RelationshipPattern[] {
    return [
      // Import/dependency relationships
      {
        // Dynamic - can be any type the LLM chooses
        type: 'module-dependency',
        description: "Module imports or requires another module",
        sourceType: ['function', 'class', 'variable', 'interface', 'import', 'export'],
        detection: {
          method: 'import-based',
          pattern: '(?:import|require)[\\s\\(]*[\'"]([^\'"]+)[\'"]',
          includeExternal: true
        },
        // Allow metadata to further describe the relationship
        metadata: {
          strength: "strong",
          impact: "direct"
        }
      },

      // Type hierarchy relationships
      {
        // Dynamic - can be any type the LLM chooses
        type: 'type-hierarchy',
        description: "Class extends or implements another type",
        sourceType: ['class', 'interface'],
        targetType: ['class', 'interface'],
        detection: {
          method: 'inheritance-based',
          pattern: '(?:extends|implements)\\s+([\\w\\.,\\s]+)',
          includeExternal: true
        },
        // Allow metadata to further describe the relationship
        metadata: {
          isA: true,
          hierarchyType: "inheritance"
        }
      },

      // Invocation relationships
      {
        // Dynamic - can be any type the LLM chooses
        type: 'invocation',
        description: "Function calls another function",
        sourceType: ['function', 'method'],
        targetType: ['function', 'method'],
        detection: {
          method: 'usage-based',
          methodCallPattern: true
        },
        // Allow metadata to further describe the relationship
        metadata: {
          runtime: true,
          flowType: "execution"
        }
      },

      // Creation relationships
      {
        // Dynamic - can be any type the LLM chooses
        type: 'creates-instance',
        description: "Code creates an instance of a class",
        sourceType: ['function', 'method', 'class'],
        targetType: ['class'],
        detection: {
          method: 'usage-based',
          pattern: 'new\\s+(\\w+)\\s*\\('
        },
        // Allow metadata to further describe the relationship
        metadata: {
          lifecycle: "creation"
        }
      },

      // Structural relationships
      {
        // Dynamic - can be any type the LLM chooses
        type: 'structural-composition',
        description: "Parent type contains child members",
        sourceType: ['class', 'interface'],
        targetType: ['method', 'variable'],
        detection: {
          method: 'containment',
          useParentProperty: true
        },
        // Allow metadata to further describe the relationship
        metadata: {
          compositionType: "has-a"
        }
      }
    ];
  }
}