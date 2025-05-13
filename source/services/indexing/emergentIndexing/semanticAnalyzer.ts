/**
 * Semantic Analyzer
 * 
 * Analyzes the semantic meaning of code elements to extract concepts and semantics.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CodebaseUnderstanding,
  Concept,
  SemanticUnit,
  SemanticResults,
  ISemanticAnalyzer
} from './types.js';

/**
 * Semantic analyzer for extracting meaningful concepts from code
 */
export class SemanticAnalyzer implements ISemanticAnalyzer {
  /**
   * Analyze the semantics of a codebase
   */
  async analyzeSemantics(understanding: CodebaseUnderstanding): Promise<SemanticResults> {
    console.log('Analyzing semantics in the codebase...');
    
    const concepts: Concept[] = [];
    const semanticUnits: SemanticUnit[] = [];
    
    // Extract concepts from code nodes
    concepts.push(...await this.extractConcepts(understanding));
    
    // Create semantic units by grouping related code elements
    semanticUnits.push(...await this.createSemanticUnits(understanding, concepts));
    
    return {
      concepts,
      semanticUnits
    };
  }
  
  /**
   * Extract concepts from code nodes
   * @private
   */
  private async extractConcepts(understanding: CodebaseUnderstanding): Promise<Concept[]> {
    const concepts: Concept[] = [];
    const wordCounts: Record<string, {count: number, nodes: string[]}> = {};
    
    // Extract words from identifiers
    for (const node of understanding.codeNodes.values()) {
      if (!node.name) continue;
      
      // Split name into words based on common naming conventions
      const words = this.splitIdentifier(node.name);
      
      for (const word of words) {
        // Skip very short or common words
        if (word.length <= 2 || this.isCommonWord(word)) continue;
        
        if (!wordCounts[word]) {
          wordCounts[word] = {count: 0, nodes: []};
        }
        
        wordCounts[word].count++;
        wordCounts[word].nodes.push(node.id);
      }
    }
    
    // Find significant words (used more than a threshold)
    const totalNodes = understanding.codeNodes.size;
    const significanceThreshold = Math.max(3, totalNodes * 0.05);
    
    for (const [word, {count, nodes}] of Object.entries(wordCounts)) {
      if (count >= significanceThreshold) {
        // This word might represent an important concept
        concepts.push({
          id: uuidv4(),
          name: this.normalizeConceptName(word),
          description: `Concept extracted from ${count} code elements`,
          codeElements: nodes,
          confidence: Math.min(count / totalNodes, 0.9),
          importance: count / totalNodes,
          relatedConcepts: []
        });
      }
    }
    
    // Identify relationships between concepts
    this.identifyConceptRelationships(concepts, wordCounts);
    
    return concepts;
  }
  
  /**
   * Create semantic units by grouping related code elements
   * @private
   */
  private async createSemanticUnits(
    _understanding: CodebaseUnderstanding,
    concepts: Concept[]
  ): Promise<SemanticUnit[]> {
    const units: SemanticUnit[] = [];
    
    // Map nodes to concepts
    const nodeToConceptsMap: Record<string, string[]> = {};
    
    for (const concept of concepts) {
      for (const nodeId of concept.codeElements) {
        if (!nodeToConceptsMap[nodeId]) {
          nodeToConceptsMap[nodeId] = [];
        }
        nodeToConceptsMap[nodeId].push(concept.id);
      }
    }
    
    // Group nodes by concept overlap
    const conceptGroups: Record<string, Set<string>> = {};
    
    for (const concept of concepts) {
      if (concept.codeElements.length < 3) continue;
      
      const groupId = uuidv4();
      conceptGroups[groupId] = new Set(concept.codeElements);
    }
    
    // Merge groups with significant overlap
    const groupMerges: [string, string][] = [];
    const groupIds = Object.keys(conceptGroups);
    
    for (let i = 0; i < groupIds.length; i++) {
      const groupId1 = groupIds[i];
      if (!groupId1) continue;

      for (let j = i + 1; j < groupIds.length; j++) {
        const groupId2 = groupIds[j];
        if (!groupId2) continue;

        const group1 = conceptGroups[groupId1];
        const group2 = conceptGroups[groupId2];
        
        // Calculate overlap
        let overlapCount = 0;
        if (group1 && group2) {
          for (const nodeId of group1) {
            if (group2.has(nodeId)) {
              overlapCount++;
            }
          }

          const overlapRatio = overlapCount / Math.min(group1.size, group2.size);

          if (overlapRatio > 0.5 && groupId1 && groupId2) {
            groupMerges.push([groupId1, groupId2]);
          }
        }
      }
    }
    
    // Apply merges
    for (const [group1Id, group2Id] of groupMerges) {
      // Skip if either group no longer exists
      if (!conceptGroups[group1Id] || !conceptGroups[group2Id]) {
        continue;
      }
      
      // Merge group2 into group1
      for (const nodeId of conceptGroups[group2Id]) {
        conceptGroups[group1Id].add(nodeId);
      }
      
      // Remove group2
      delete conceptGroups[group2Id];
    }
    
    // Create semantic units from the resulting groups
    for (const [_groupId, nodeIds] of Object.entries(conceptGroups)) {
      if (nodeIds.size < 2) continue;
      
      // Determine the most common concepts in this group
      const conceptCounts: Record<string, number> = {};
      
      for (const nodeId of nodeIds) {
        if (nodeToConceptsMap[nodeId]) {
          for (const conceptId of nodeToConceptsMap[nodeId]) {
            conceptCounts[conceptId] = (conceptCounts[conceptId] || 0) + 1;
          }
        }
      }
      
      // Sort concepts by count
      const dominantConcepts = Object.entries(conceptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
      
      // Find a name for this semantic unit
      let unitName = 'Unknown Unit';
      if (dominantConcepts.length > 0) {
        const concept = concepts.find(c => c.id === dominantConcepts[0]);
        if (concept) {
          unitName = `${concept.name} Module`;
        }
      }
      
      // Create the semantic unit
      units.push({
        id: uuidv4(),
        type: 'module',
        name: unitName,
        description: `A group of ${nodeIds.size} related code elements`,
        codeNodeIds: Array.from(nodeIds),
        confidence: 0.7,
        concepts: dominantConcepts,
        semanticProperties: {
          cohesion: 0.7,
          size: nodeIds.size
        }
      });
    }
    
    return units;
  }
  
  /**
   * Split an identifier into words
   * @private
   */
  private splitIdentifier(identifier: string): string[] {
    // Handle different naming conventions
    
    // camelCase or PascalCase
    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(identifier) && /[A-Z]/.test(identifier)) {
      return identifier
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/\s+/);
    }
    
    // snake_case
    if (identifier.includes('_')) {
      return identifier.toLowerCase().split('_').filter(Boolean);
    }
    
    // kebab-case
    if (identifier.includes('-')) {
      return identifier.toLowerCase().split('-').filter(Boolean);
    }
    
    // Unknown format, just return the identifier as is
    return [identifier.toLowerCase()];
  }
  
  /**
   * Check if a word is a common programming word to filter out
   * @private
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      // Programming-specific common words
      'get', 'set', 'add', 'remove', 'create', 'delete', 'update', 'fetch',
      'init', 'start', 'stop', 'handle', 'process', 'execute', 'run', 'parse',
      'load', 'save', 'build', 'make', 'test', 'check', 'validate', 'verify',
      'format', 'convert', 'transform', 'calculate', 'compute', 'count',
      'index', 'key', 'value', 'item', 'element', 'node', 'component', 'module',
      'util', 'helper', 'service', 'factory', 'provider', 'manager', 'controller',
      'model', 'view', 'template', 'function', 'method', 'callback', 'event',
      'listener', 'handler', 'config', 'setup', 'init', 'main', 'app', 'default',
      'container', 'wrapper', 'provider', 'context', 'store', 'state', 'props',
      'param', 'arg', 'input', 'output', 'result', 'response', 'request', 'data',
      'info', 'error', 'warning', 'log', 'debug', 'temp', 'tmp', 'flag', 'enabled',
      'disabled', 'active', 'visible', 'hidden', 'selected', 'current', 'next',
      'prev', 'first', 'last', 'new', 'old', 'min', 'max', 'sum', 'avg', 'count'
    ];
    
    return commonWords.includes(word.toLowerCase());
  }
  
  /**
   * Normalize a concept name
   * @private
   */
  private normalizeConceptName(word: string): string {
    // Capitalize the first letter
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  
  /**
   * Identify relationships between concepts
   * @private
   */
  private identifyConceptRelationships(
    concepts: Concept[],
    _wordCounts: Record<string, {count: number, nodes: string[]}>
  ): void {
    // Find related concepts based on co-occurrence
    for (let i = 0; i < concepts.length; i++) {
      const concept1 = concepts[i];
      if (!concept1) continue;

      const nodes1 = new Set(concept1.codeElements);

      for (let j = i + 1; j < concepts.length; j++) {
        const concept2 = concepts[j];
        if (!concept2) continue;

        const nodes2 = new Set(concept2.codeElements);

        // Count overlap
        let overlapCount = 0;
        for (const nodeId of nodes1) {
          if (nodes2.has(nodeId)) {
            overlapCount++;
          }
        }

        // Calculate Jaccard index (overlap / union)
        const union = new Set([...nodes1, ...nodes2]).size;
        const similarity = overlapCount / union;

        // If there's significant similarity, create a relationship
        if (similarity > 0.3) {
          concept1.relatedConcepts.push(concept2.id);
          concept2.relatedConcepts.push(concept1.id);
        }
      }
    }
  }
}