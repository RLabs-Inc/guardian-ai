/**
 * Enhanced Semantic Analyzer
 * 
 * Analyzes the semantic meaning of code elements to extract concepts and semantics 
 * with deeper code understanding and NLP-based techniques.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CodebaseUnderstanding,
  CodeNode,
  Concept,
  SemanticUnit,
  SemanticResults,
  ISemanticAnalyzer,
  CodeNodeType
} from './types.js';

/**
 * Enhanced semantic analyzer for extracting meaningful concepts from code
 */
export class EnhancedSemanticAnalyzer implements ISemanticAnalyzer {
  /**
   * Analyze the semantics of a codebase
   */
  async analyzeSemantics(understanding: CodebaseUnderstanding): Promise<SemanticResults> {
    console.log('Analyzing semantics in the codebase...');
    
    const concepts: Concept[] = [];
    const semanticUnits: SemanticUnit[] = [];
    
    // Extract concepts from multiple dimensions:
    // 1. File/module level concepts
    concepts.push(...await this.extractFileModuleConcepts(understanding));
    
    // 2. Code identifier concepts (from functions, classes, etc.)
    concepts.push(...await this.extractIdentifierConcepts(understanding));
    
    // 3. Comment and documentation concepts
    concepts.push(...await this.extractDocumentationConcepts(understanding));
    
    // 4. Data structure concepts
    concepts.push(...await this.extractDataStructureConcepts(understanding));
    
    // Create semantic units by grouping related code elements
    semanticUnits.push(...await this.createSemanticUnits(understanding, concepts));
    
    // Process relationship between concepts
    await this.enhanceConceptRelationships(concepts, understanding);
    
    return {
      concepts,
      semanticUnits
    };
  }
  
  /**
   * Extract concepts from file and module structure
   * @private
   */
  private async extractFileModuleConcepts(understanding: CodebaseUnderstanding): Promise<Concept[]> {
    const concepts: Concept[] = [];
    const wordCounts: Record<string, {count: number, nodes: string[], importance: number}> = {};
    
    // Extract words from file and module names
    for (const node of understanding.codeNodes.values()) {
      if (!node.name) continue;
      
      // Skip non-module nodes for this analysis
      if (node.type !== CodeNodeType.MODULE && String(node.type).toLowerCase() !== 'module') continue;
      
      // Split name into words based on common naming conventions
      const words = this.splitIdentifier(node.name);
      
      for (const word of words) {
        // Skip very short or common words
        if (word.length <= 2 || this.isCommonWord(word)) continue;
        
        if (!wordCounts[word]) {
          wordCounts[word] = {count: 0, nodes: [], importance: 0};
        }
        
        wordCounts[word].count++;
        wordCounts[word].nodes.push(node.id);
        
        // Files with special names are more important
        if (this.isSignificantModuleName(node.name)) {
          wordCounts[word].importance += 0.5;
        }
      }
    }
    
    // Find significant words (used more than a threshold)
    const totalNodes = understanding.codeNodes.size;
    const fileSignificanceThreshold = Math.max(2, Math.ceil(totalNodes * 0.02));
    
    for (const [word, {count, nodes, importance}] of Object.entries(wordCounts)) {
      if (count >= fileSignificanceThreshold || importance > 0.5) {
        // Calculate adjusted confidence based on count and importance
        const confidence = Math.min(0.9, 0.4 + (count / totalNodes) + (importance * 0.1));
        
        // This word might represent an important file/module concept
        concepts.push({
          id: uuidv4(),
          name: this.normalizeConceptName(word),
          description: `Concept extracted from ${count} file and module names`,
          codeElements: nodes,
          confidence: confidence,
          importance: (count / totalNodes) + importance,
          relatedConcepts: []
        });
      }
    }
    
    return concepts;
  }

  /**
   * Extract concepts from code identifiers (functions, classes, etc.)
   * @private
   */
  private async extractIdentifierConcepts(understanding: CodebaseUnderstanding): Promise<Concept[]> {
    const concepts: Concept[] = [];
    const wordCounts: Record<string, {count: number, nodes: string[], types: Set<string>}> = {};
    
    // Analyze all code nodes for identifier patterns
    for (const node of understanding.codeNodes.values()) {
      if (!node.name) continue;
      
      // Skip module nodes as we already processed them
      if (node.type === CodeNodeType.MODULE || String(node.type).toLowerCase() === 'module') continue;
      
      // Get the node type as string
      const nodeType = typeof node.type === 'string' ? 
        node.type.toLowerCase() : String(node.type).toLowerCase();
      
      // Split name into words
      const words = this.splitIdentifier(node.name);
      
      for (const word of words) {
        // Skip very short or common words
        if (word.length <= 2 || this.isCommonWord(word)) continue;
        
        if (!wordCounts[word]) {
          wordCounts[word] = {count: 0, nodes: [], types: new Set()};
        }
        
        wordCounts[word].count++;
        wordCounts[word].nodes.push(node.id);
        wordCounts[word].types.add(nodeType);
      }
    }
    
    // Find significant identifier concepts based on multiple criteria
    const totalNodes = understanding.codeNodes.size;
    
    for (const [word, {count, nodes, types}] of Object.entries(wordCounts)) {
      // Calculate a significance score based on multiple factors
      const frequency = count / totalNodes;
      const typeVariety = types.size / 4; // Normalize by typical max number of types
      const significance = frequency + (typeVariety * 0.2);
      
      // Check if this is significant enough to be a concept
      if (count >= 3 || significance > 0.05) {
        // Calculate adjusted confidence based on evidence strength
        const confidence = Math.min(0.9, 0.5 + (frequency * 5) + (typeVariety * 0.2));
        const importance = Math.min(0.9, frequency * 10 + typeVariety * 0.2);
        
        // Create a meaningful description based on where this concept appears
        const typeDescription = Array.from(types).join(', ');
        
        concepts.push({
          id: uuidv4(),
          name: this.normalizeConceptName(word),
          description: `Concept extracted from ${count} ${typeDescription} identifiers`,
          codeElements: nodes,
          confidence: confidence,
          importance: importance,
          relatedConcepts: []
        });
      }
    }
    
    return concepts;
  }

  /**
   * Extract concepts from comments and documentation
   * @private
   */
  private async extractDocumentationConcepts(understanding: CodebaseUnderstanding): Promise<Concept[]> {
    const concepts: Concept[] = [];
    const commentTerms: Record<string, {count: number, nodes: string[], importance: number}> = {};
    
    // Process code nodes looking for comments in content or metadata
    for (const node of understanding.codeNodes.values()) {
      // Look for comments in content
      if (node.content) {
        const commentLines = this.extractCommentLines(node.content);
        if (commentLines.length > 0) {
          // Process each comment line
          for (const line of commentLines) {
            const terms = this.extractKeyTermsFromComment(line);
            this.updateCommentTerms(terms, node.id, commentTerms);
          }
        }
      }
      
      // Look for documentation in metadata
      if (node.metadata && typeof node.metadata === 'object') {
        const docKeys = ['documentation', 'comment', 'jsdoc', 'doc', 'description'];
        
        for (const key of docKeys) {
          const docValue = node.metadata[key];
          if (typeof docValue === 'string' && docValue.length > 0) {
            const terms = this.extractKeyTermsFromComment(docValue);
            this.updateCommentTerms(terms, node.id, commentTerms, 1.2); // Higher importance for explicit documentation
          }
        }
      }
    }
    
    // Convert comment terms to concepts
    for (const [term, {count, nodes, importance}] of Object.entries(commentTerms)) {
      // Only consider terms with sufficient support
      if (count < 2) continue;
      
      // Calculate confidence and importance
      const confidence = Math.min(0.85, 0.4 + (count * 0.05) + (importance * 0.1));
      const termImportance = Math.min(0.8, 0.3 + (count * 0.02) + (importance * 0.1));
      
      concepts.push({
        id: uuidv4(),
        name: this.normalizeConceptName(term),
        description: `Concept extracted from ${count} documentation comments`,
        codeElements: nodes,
        confidence: confidence,
        importance: termImportance,
        relatedConcepts: []
      });
    }
    
    return concepts;
  }

  /**
   * Extract concepts from data structures (classes, interfaces, etc.)
   * @private
   */
  private async extractDataStructureConcepts(understanding: CodebaseUnderstanding): Promise<Concept[]> {
    const concepts: Concept[] = [];
    const dataStructures: Record<string, {node: CodeNode, properties: string[], methods: string[]}> = {};
    
    // Find data structure nodes (classes, interfaces, etc.)
    for (const node of understanding.codeNodes.values()) {
      const nodeType = typeof node.type === 'string' ? 
        node.type.toLowerCase() : String(node.type).toLowerCase();
      
      // Identify data structure nodes
      if (nodeType === 'class' || nodeType === 'interface' || nodeType === 'struct' || nodeType === 'type') {
        // Initialize entry
        dataStructures[node.id] = {
          node,
          properties: [],
          methods: []
        };
        
        // Find properties and methods
        if (node.children) {
          for (const child of node.children) {
            const childType = typeof child.type === 'string' ? 
              child.type.toLowerCase() : String(child.type).toLowerCase();
            
            if (childType === 'property' || childType === 'field') {
              const nodeData = dataStructures[node.id];
              if (nodeData && nodeData.properties) {
                nodeData.properties.push(child.name || '');
              }
            } else if (childType === 'method' || childType === 'function') {
              const nodeData = dataStructures[node.id];
              if (nodeData && nodeData.methods) {
                nodeData.methods.push(child.name || '');
              }
            }
          }
        }
      }
    }
    
    // Create concepts from data structures
    for (const {node, properties, methods} of Object.values(dataStructures)) {
      if (!node.name) continue;
      
      // Calculate a confidence score based on completeness
      const hasProperties = properties.length > 0;
      const hasMethods = methods.length > 0;
      const completeness = (hasProperties ? 0.4 : 0) + (hasMethods ? 0.4 : 0) + 0.2;
      
      // Generate a description
      let description = `Data structure representing ${this.splitIdentifier(node.name).join(' ')}`;
      if (hasProperties) {
        description += ` with ${properties.length} properties`;
      }
      if (hasMethods) {
        description += `${hasProperties ? ' and' : ' with'} ${methods.length} methods`;
      }
      
      // Create the concept
      concepts.push({
        id: uuidv4(),
        name: node.name,
        description,
        codeElements: [node.id],
        confidence: Math.min(0.9, 0.5 + (completeness * 0.4)),
        importance: Math.min(0.9, 0.4 + (completeness * 0.5)),
        relatedConcepts: []
      });
    }
    
    return concepts;
  }
  
  /**
   * Create semantic units by grouping related code elements
   * @private
   */
  private async createSemanticUnits(
    understanding: CodebaseUnderstanding,
    concepts: Concept[]
  ): Promise<SemanticUnit[]> {
    const units: SemanticUnit[] = [];
    
    // Enhanced approach combining multiple techniques:
    
    // 1. Concept-based units (grouping by dominant concepts)
    units.push(...await this.createConceptBasedUnits(understanding, concepts));
    
    // 2. Pattern-based units (grouping by code patterns)
    units.push(...await this.createPatternBasedUnits(understanding));
    
    // 3. Relationship-based units (grouping by tight coupling)
    units.push(...await this.createRelationshipBasedUnits(understanding));
    
    // 4. Directory-based units (with semantic coherence checks)
    units.push(...await this.createDirectoryBasedUnits(understanding, concepts));
    
    return units;
  }

  /**
   * Create semantic units based on concept groupings
   * @private
   */
  private async createConceptBasedUnits(
    understanding: CodebaseUnderstanding,
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
    
    // Find high-coherence groups
    for (const concept of concepts) {
      // Skip concepts with too few elements
      if (concept.codeElements.length < 3) continue;
      
      // Check if elements form a coherent semantic unit
      const coherenceScore = this.calculateConceptCoherence(concept, understanding);
      
      // Only create units for concepts with high coherence
      if (coherenceScore > 0.5) {
        // Create a semantic unit
        units.push({
          id: uuidv4(),
          type: this.determineSemanticUnitType(concept, understanding),
          name: `${concept.name} ${this.determineSemanticUnitType(concept, understanding)}`,
          description: `A semantic unit based on the ${concept.name} concept`,
          codeNodeIds: concept.codeElements,
          confidence: Math.min(0.95, concept.confidence + (coherenceScore * 0.2)),
          concepts: [concept.id],
          semanticProperties: {
            cohesion: coherenceScore,
            size: concept.codeElements.length,
            dominantConcept: concept.name
          }
        });
      }
    }
    
    return units;
  }

  /**
   * Create semantic units based on discovered code patterns
   * @private
   */
  private async createPatternBasedUnits(
    understanding: CodebaseUnderstanding
  ): Promise<SemanticUnit[]> {
    const units: SemanticUnit[] = [];
    
    // Use discovered patterns to form semantic units
    for (const pattern of understanding.patterns) {
      // Skip patterns that are too common or too rare
      if (pattern.confidence < 0.6 || pattern.instances.length < 3) continue;
      
      // Create a semantic unit from the pattern instances
      // Extract node IDs from pattern instances
      const nodeIds = pattern.instances.map((instance: { nodeId: string }) => instance.nodeId);
      
      units.push({
        id: uuidv4(),
        type: 'pattern',
        name: `${pattern.name} Pattern`,
        description: `A semantic unit based on the ${pattern.name} pattern`,
        codeNodeIds: nodeIds,
        confidence: pattern.confidence,
        concepts: [],
        semanticProperties: {
          patternType: pattern.type,
          patternName: pattern.name,
          size: pattern.instances.length,
          cohesion: 0.65 // Moderate default cohesion for pattern-based units
        }
      });
    }
    
    return units;
  }

  /**
   * Create semantic units based on relationship density
   * @private
   */
  private async createRelationshipBasedUnits(
    understanding: CodebaseUnderstanding
  ): Promise<SemanticUnit[]> {
    const units: SemanticUnit[] = [];
    
    // Build a relationship graph
    const nodeRelationships: Record<string, Set<string>> = {};
    
    // Initialize relationship sets
    for (const node of understanding.codeNodes.values()) {
      nodeRelationships[node.id] = new Set();
    }
    
    // Populate relationships
    for (const relationship of understanding.relationships) {
      const sourceSet = nodeRelationships[relationship.sourceId];
      if (sourceSet) {
        sourceSet.add(relationship.targetId);
      }
      
      const targetSet = nodeRelationships[relationship.targetId];
      if (targetSet) {
        targetSet.add(relationship.sourceId);
      }
    }
    
    // Find tightly coupled groups using a simple clustering approach
    const visitedNodes = new Set<string>();
    
    for (const nodeId of Object.keys(nodeRelationships)) {
      if (visitedNodes.has(nodeId)) continue;
      
      // Start a new cluster from this node
      const cluster = await this.expandRelationshipCluster(
        nodeId, 
        nodeRelationships, 
        visitedNodes,
        0.7 // Minimum relationship density
      );
      
      // Only create units for sufficiently large clusters
      if (cluster.size >= 4) {
        // Get the node names for a meaningful unit name
        const nodeNames = Array.from(cluster)
          .map(id => {
            const node = understanding.codeNodes.get(id);
            return node ? node.name : '';
          })
          .filter(Boolean);
        
        // Find a common prefix or pattern in the names
        const unitName = this.findCommonNamePattern(nodeNames);
        
        units.push({
          id: uuidv4(),
          type: 'component',
          name: unitName,
          description: `A tightly coupled component with ${cluster.size} elements`,
          codeNodeIds: Array.from(cluster),
          confidence: 0.75,
          concepts: [],
          semanticProperties: {
            size: cluster.size,
            cohesion: 0.8, // High cohesion due to relationship density
            coupling: 'high'
          }
        });
      }
    }
    
    return units;
  }

  /**
   * Create semantic units based on directory structure with cohesion checks
   * @private
   */
  private async createDirectoryBasedUnits(
    understanding: CodebaseUnderstanding,
    concepts: Concept[]
  ): Promise<SemanticUnit[]> {
    const units: SemanticUnit[] = [];
    
    // Group nodes by directory
    const dirToNodesMap: Record<string, string[]> = {};
    
    for (const node of understanding.codeNodes.values()) {
      if (!node.path) continue;
      
      const dirPath = this.getDirectoryPath(node.path);
      if (!dirToNodesMap[dirPath]) {
        dirToNodesMap[dirPath] = [];
      }
      
      dirToNodesMap[dirPath].push(node.id);
    }
    
    // Create units for directories with coherent content
    for (const [dirPath, nodeIds] of Object.entries(dirToNodesMap)) {
      // Skip directories with too few files
      if (nodeIds.length < 3) continue;
      
      // Check semantic coherence
      const { coherence, dominantConcepts } = 
        await this.evaluateDirectoryCoherence(nodeIds, concepts, understanding);
      
      // Only create units for directories with sufficient coherence
      if (coherence > 0.5) {
        const dirName = this.getDirectoryName(dirPath);
        
        units.push({
          id: uuidv4(),
          type: 'module',
          name: `${dirName} Module`,
          description: `A semantic unit based on the ${dirName} directory`,
          codeNodeIds: nodeIds,
          confidence: Math.min(0.9, 0.6 + (coherence * 0.3)),
          concepts: dominantConcepts,
          semanticProperties: {
            dirPath,
            cohesion: coherence,
            size: nodeIds.length
          }
        });
      }
    }
    
    return units;
  }

  /**
   * Enhance the relationships between concepts
   * @private
   */
  private async enhanceConceptRelationships(
    concepts: Concept[],
    understanding: CodebaseUnderstanding
  ): Promise<void> {
    // Integrate multiple relationship measures
    
    // 1. Co-occurrence in code elements
    this.buildCoOccurrenceRelationships(concepts);
    
    // 2. Semantic similarity
    this.buildSemanticSimilarityRelationships(concepts);
    
    // 3. Structural relationships
    this.buildStructuralRelationships(concepts, understanding);
    
    // 4. Data flow connections
    this.buildDataFlowRelationships(concepts, understanding);
  }

  /**
   * Build concept relationships based on code element co-occurrence
   * @private
   */
  private buildCoOccurrenceRelationships(concepts: Concept[]): void {
    // Create a map of nodes to concepts
    const nodeToConceptsMap: Record<string, Set<string>> = {};
    
    for (const concept of concepts) {
      for (const nodeId of concept.codeElements) {
        if (!nodeToConceptsMap[nodeId]) {
          nodeToConceptsMap[nodeId] = new Set();
        }
        
        nodeToConceptsMap[nodeId].add(concept.id);
      }
    }
    
    // Find co-occurrence relationships between concepts
    for (let i = 0; i < concepts.length; i++) {
      const concept1 = concepts[i];
      if (!concept1) continue;
      
      for (let j = i + 1; j < concepts.length; j++) {
        const concept2 = concepts[j];
        if (!concept2) continue;
        
        // Count how many nodes they share
        let sharedNodeCount = 0;
        for (const nodeId of concept1.codeElements) {
          if (concept2.codeElements.includes(nodeId)) {
            sharedNodeCount++;
          }
        }
        
        // Calculate the Jaccard similarity
        const union = new Set([...concept1.codeElements, ...concept2.codeElements]).size;
        const similarity = sharedNodeCount / union;
        
        // Create relationship if similarity is significant
        if (similarity > 0.2) {
          // Add bidirectional relationship
          if (!concept1.relatedConcepts.includes(concept2.id)) {
            concept1.relatedConcepts.push(concept2.id);
          }
          
          if (!concept2.relatedConcepts.includes(concept1.id)) {
            concept2.relatedConcepts.push(concept1.id);
          }
        }
      }
    }
  }

  /**
   * Build concept relationships based on name/description semantic similarity
   * @private
   */
  private buildSemanticSimilarityRelationships(concepts: Concept[]): void {
    for (let i = 0; i < concepts.length; i++) {
      const concept1 = concepts[i];
      if (!concept1) continue;
      
      for (let j = i + 1; j < concepts.length; j++) {
        const concept2 = concepts[j];
        if (!concept2) continue;
        
        // Calculate name similarity
        const nameSimilarity = this.calculateTextSimilarity(
          concept1.name.toLowerCase(), 
          concept2.name.toLowerCase()
        );
        
        // Calculate description similarity
        const descSimilarity = this.calculateTextSimilarity(
          concept1.description.toLowerCase(),
          concept2.description.toLowerCase()
        );
        
        // Combined similarity score
        const combinedSimilarity = (nameSimilarity * 0.7) + (descSimilarity * 0.3);
        
        // Create relationship if similarity is high
        if (combinedSimilarity > 0.6) {
          // Add bidirectional relationship
          if (!concept1.relatedConcepts.includes(concept2.id)) {
            concept1.relatedConcepts.push(concept2.id);
          }
          
          if (!concept2.relatedConcepts.includes(concept1.id)) {
            concept2.relatedConcepts.push(concept1.id);
          }
        }
      }
    }
  }

  /**
   * Build concept relationships based on structural relationships
   * @private
   */
  private buildStructuralRelationships(
    concepts: Concept[],
    understanding: CodebaseUnderstanding
  ): void {
    // Build a map from nodes to concepts
    const nodeToConceptsMap: Record<string, string[]> = {};
    
    for (const concept of concepts) {
      for (const nodeId of concept.codeElements) {
        if (!nodeToConceptsMap[nodeId]) {
          nodeToConceptsMap[nodeId] = [];
        }
        
        nodeToConceptsMap[nodeId].push(concept.id);
      }
    }
    
    // Map of concept pairs to relationship strengths
    const relationshipStrengths: Record<string, number> = {};
    
    // Analyze structural relationships between nodes to infer concept relationships
    for (const relationship of understanding.relationships) {
      const sourceConcepts = nodeToConceptsMap[relationship.sourceId] || [];
      const targetConcepts = nodeToConceptsMap[relationship.targetId] || [];
      
      // For each concept pair, increment relationship strength
      for (const sourceConceptId of sourceConcepts) {
        for (const targetConceptId of targetConcepts) {
          // Skip self-relationships
          if (sourceConceptId === targetConceptId) continue;
          
          // Create a unique key for this concept pair
          const key = [sourceConceptId, targetConceptId].sort().join('-');
          
          // Increment relationship strength
          relationshipStrengths[key] = (relationshipStrengths[key] || 0) + 1;
        }
      }
    }
    
    // Create concept relationships based on accumulated strength
    for (const [key, strength] of Object.entries(relationshipStrengths)) {
      // Only create relationships with sufficient strength
      if (strength < 2) continue;
      
      const [conceptId1, conceptId2] = key.split('-');
      
      // Find the concepts by id
      const concept1 = concepts.find(c => c.id === conceptId1);
      const concept2 = concepts.find(c => c.id === conceptId2);
      
      if (concept1 && concept2) {
        // Add bidirectional relationship
        if (!concept1.relatedConcepts.includes(concept2.id)) {
          concept1.relatedConcepts.push(concept2.id);
        }
        
        if (!concept2.relatedConcepts.includes(concept1.id)) {
          concept2.relatedConcepts.push(concept1.id);
        }
      }
    }
  }

  /**
   * Build concept relationships based on data flow connections
   * @private
   */
  private buildDataFlowRelationships(
    concepts: Concept[],
    understanding: CodebaseUnderstanding
  ): void {
    if (!understanding.dataFlow) return;
    
    // Build a map from nodes to concepts
    const nodeToConceptsMap: Record<string, string[]> = {};
    
    for (const concept of concepts) {
      for (const nodeId of concept.codeElements) {
        if (!nodeToConceptsMap[nodeId]) {
          nodeToConceptsMap[nodeId] = [];
        }
        
        nodeToConceptsMap[nodeId].push(concept.id);
      }
    }
    
    // Map from code nodes to data flow nodes
    const codeToDataNodeMap: Record<string, string[]> = {};
    
    // Build the mapping
    for (const [id, node] of understanding.dataFlow.nodes.entries()) {
      if (!node.nodeId) continue;
      
      if (node.nodeId) {
        // Initialize array if needed
        if (!codeToDataNodeMap[node.nodeId]) {
          codeToDataNodeMap[node.nodeId] = [];
        }
        
        // Use non-null assertion since we just checked and initialized if needed
        codeToDataNodeMap[node.nodeId]!.push(id);
      }
    }
    
    // Map of concept pairs to flow strengths
    const flowStrengths: Record<string, number> = {};
    
    // Analyze data flows to infer concept relationships
    for (const flow of understanding.dataFlow.flows) {
      // Find source data node
      const sourceNode = understanding.dataFlow.nodes.get(flow.sourceId);
      
      // Find target data node
      const targetNode = understanding.dataFlow.nodes.get(flow.targetId);
      
      if (!sourceNode || !targetNode || !sourceNode.nodeId || !targetNode.nodeId) continue;
      
      // Find concepts for these nodes
      const sourceConcepts = nodeToConceptsMap[sourceNode.nodeId] || [];
      const targetConcepts = nodeToConceptsMap[targetNode.nodeId] || [];
      
      // For each concept pair, increment flow strength
      for (const sourceConceptId of sourceConcepts) {
        for (const targetConceptId of targetConcepts) {
          // Skip self-flows
          if (sourceConceptId === targetConceptId) continue;
          
          // Create a unique directional key for this concept pair
          // Data flows are directional, so we don't sort the key
          const key = `${sourceConceptId}->${targetConceptId}`;
          
          // Increment flow strength
          flowStrengths[key] = (flowStrengths[key] || 0) + 1;
        }
      }
    }
    
    // Create concept relationships based on accumulated flow strength
    for (const [key, strength] of Object.entries(flowStrengths)) {
      // Only create relationships with sufficient strength
      if (strength < 2) continue;
      
      const [sourceConceptId, targetConceptId] = key.split('->');
      
      // Find the concepts by id
      const sourceConcept = concepts.find(c => c.id === sourceConceptId);
      const targetConcept = concepts.find(c => c.id === targetConceptId);
      
      if (sourceConcept && targetConcept && targetConceptId) {
        // Add directional relationship - data flows tend to be directional
        if (!sourceConcept.relatedConcepts.includes(targetConceptId)) {
          sourceConcept.relatedConcepts.push(targetConceptId);
        }
      }
    }
  }

  // ===== Helper methods =====

  /**
   * Split an identifier into words
   * @private
   */
  private splitIdentifier(identifier: string): string[] {
    if (!identifier) return [];
    
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
    
    // handle dot notation (e.g., file extensions)
    if (identifier.includes('.')) {
      return identifier.toLowerCase().split('.').filter(Boolean);
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
      'util', 'utility', 'helper', 'service', 'factory', 'provider', 'manager', 'controller',
      'model', 'view', 'template', 'function', 'method', 'callback', 'event',
      'listener', 'handler', 'config', 'setup', 'init', 'main', 'app', 'default',
      'container', 'wrapper', 'provider', 'context', 'store', 'state', 'props',
      'param', 'arg', 'input', 'output', 'result', 'response', 'request', 'data',
      'info', 'error', 'warning', 'log', 'debug', 'temp', 'tmp', 'flag', 'enabled',
      'disabled', 'active', 'visible', 'hidden', 'selected', 'current', 'next',
      'prev', 'first', 'last', 'new', 'old', 'min', 'max', 'sum', 'avg', 'count',
      'file', 'dir', 'folder', 'path', 'name', 'id', 'src', 'source'
    ];
    
    return commonWords.includes(word.toLowerCase());
  }
  
  /**
   * Check if a module name has special significance
   * @private
   */
  private isSignificantModuleName(name: string): boolean {
    // Special file/module names that typically contain important concepts
    const significantNames = [
      'index',
      'main',
      'core',
      'types',
      'constants',
      'config',
      'api',
      'service',
      'model',
      'schema',
      'store',
      'context',
      'provider',
      'controller',
      'router',
      'utils',
      'helpers',
      'common',
      'shared'
    ];
    
    return significantNames.includes(name.toLowerCase());
  }
  
  /**
   * Normalize a concept name
   * @private
   */
  private normalizeConceptName(word: string): string {
    if (!word) return '';
    
    // Capitalize the first letter
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  /**
   * Extract comment lines from code content
   * @private
   */
  private extractCommentLines(content: unknown): string[] {
    if (typeof content !== 'string') return [];
    
    const lines = content.split('\n');
    const commentLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match different comment styles
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('--') ||
        trimmed.startsWith('*') ||
        (trimmed.startsWith('/*') && trimmed.endsWith('*/')) ||
        trimmed.startsWith('"""') ||
        trimmed.startsWith("'''")
      ) {
        // Clean up the comment markers
        let cleanComment = trimmed
          .replace(/^\/\/\s*|^#\s*|^--\s*|\*\s*|^\/\*\s*|\*\/\s*|^"""\s*|^'''\s*/g, '')
          .trim();
        
        if (cleanComment) {
          commentLines.push(cleanComment);
        }
      }
    }
    
    return commentLines;
  }

  /**
   * Extract key terms from a comment string
   * @private
   */
  private extractKeyTermsFromComment(comment: string): string[] {
    if (!comment) return [];
    
    // Normalize the comment
    const normalized = comment.toLowerCase();
    
    // Split into words and remove punctuation
    const words = normalized
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2); // Filter out very short words
    
    // Remove common stopwords
    const stopwords = [
      'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 
      'by', 'of', 'this', 'that', 'it', 'from', 'as', 'be', 'is', 'are', 
      'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 
      'did', 'but', 'or', 'if', 'while', 'when'
    ];
    
    const filteredWords = words.filter(w => !stopwords.includes(w) && !this.isCommonWord(w));
    
    // Extract noun phrases (simple approach)
    const terms: string[] = [...filteredWords];
    
    // Look for multi-word terms (adjacent nouns)
    for (let i = 0; i < filteredWords.length - 1; i++) {
      const phrase = `${filteredWords[i]} ${filteredWords[i + 1]}`;
      terms.push(phrase);
    }
    
    return terms;
  }

  /**
   * Update comment terms with new terms from a node
   * @private
   */
  private updateCommentTerms(
    terms: string[],
    nodeId: string,
    termMap: Record<string, {count: number, nodes: string[], importance: number}>,
    importanceMultiplier: number = 1
  ): void {
    for (const term of terms) {
      if (!termMap[term]) {
        termMap[term] = {count: 0, nodes: [], importance: 0};
      }
      
      termMap[term].count++;
      if (!termMap[term].nodes.includes(nodeId)) {
        termMap[term].nodes.push(nodeId);
      }
      termMap[term].importance += importanceMultiplier;
    }
  }

  /**
   * Calculate the coherence of a concept
   * @private
   */
  private calculateConceptCoherence(
    concept: Concept,
    understanding: CodebaseUnderstanding
  ): number {
    // If the concept has very few elements, coherence is low
    if (concept.codeElements.length < 3) return 0.3;
    
    // Check if the elements are in the same or related directories
    const dirPaths = new Set<string>();
    
    for (const nodeId of concept.codeElements) {
      const node = understanding.codeNodes.get(nodeId);
      if (node && node.path) {
        dirPaths.add(this.getDirectoryPath(node.path));
      }
    }
    
    // If elements are spread across too many directories, coherence is lower
    const dirRatio = 1 - Math.min(0.8, (dirPaths.size / concept.codeElements.length));
    
    // Check relationships between elements
    let relatedElementPairs = 0;
    const totalPossiblePairs = (concept.codeElements.length * (concept.codeElements.length - 1)) / 2;
    
    for (const relationship of understanding.relationships) {
      const sourceIdInConcept = concept.codeElements.includes(relationship.sourceId);
      const targetIdInConcept = concept.codeElements.includes(relationship.targetId);
      
      if (sourceIdInConcept && targetIdInConcept) {
        relatedElementPairs++;
      }
    }
    
    const relationshipRatio = totalPossiblePairs > 0 ? 
      relatedElementPairs / totalPossiblePairs : 0;
    
    // Check name similarity between elements
    const nameCoherence = this.calculateNameCoherence(concept.codeElements, understanding);
    
    // Weighted coherence score
    return (dirRatio * 0.4) + (relationshipRatio * 0.3) + (nameCoherence * 0.3);
  }

  /**
   * Calculate coherence based on element names
   * @private
   */
  private calculateNameCoherence(
    nodeIds: string[],
    understanding: CodebaseUnderstanding
  ): number {
    // Get all node names
    const nodeNames: string[] = [];
    
    for (const nodeId of nodeIds) {
      const node = understanding.codeNodes.get(nodeId);
      if (node && node.name) {
        nodeNames.push(node.name.toLowerCase());
      }
    }
    
    if (nodeNames.length < 2) return 0.5; // Default for too few nodes
    
    // Split names into word sets
    const wordSets: Set<string>[] = nodeNames.map(name => 
      new Set(this.splitIdentifier(name))
    );
    
    // Calculate average Jaccard similarity between word sets
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        if (wordSets[i] && wordSets[j]) {
          totalSimilarity += this.calculateJaccardSimilarity(wordSets[i], wordSets[j]);
          pairCount++;
        }
      }
    }
    
    return pairCount > 0 ? totalSimilarity / pairCount : 0.5;
  }

  /**
   * Calculate Jaccard similarity between two sets
   * @private
   */
  private calculateJaccardSimilarity(set1: Set<string> | undefined, set2: Set<string> | undefined): number {
    if (!set1 || !set2) return 0;
    
    const intersection = new Set([...set1].filter(item => set2.has(item)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Determine the most appropriate semantic unit type for a concept
   * @private
   */
  private determineSemanticUnitType(
    concept: Concept,
    understanding: CodebaseUnderstanding
  ): string {
    // Type counting for elements in this concept
    const typeCounts: Record<string, number> = {};
    let totalElements = 0;
    
    for (const nodeId of concept.codeElements) {
      const node = understanding.codeNodes.get(nodeId);
      if (node) {
        const nodeType = typeof node.type === 'string' ? 
          node.type.toLowerCase() : String(node.type).toLowerCase();
        
        typeCounts[nodeType] = (typeCounts[nodeType] || 0) + 1;
        totalElements++;
      }
    }
    
    // If no elements found, default to "component"
    if (totalElements === 0) return 'component';
    
    // Find the dominant type
    let dominantType = 'component';
    let maxCount = 0;
    
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }
    
    // Map internal type to user-friendly type
    const typeMap: Record<string, string> = {
      'module': 'module',
      'class': 'class',
      'interface': 'interface',
      'function': 'function',
      'method': 'service',
      'variable': 'datastore',
      'property': 'schema',
      'enum': 'enum',
      'namespace': 'namespace'
    };
    
    return typeMap[dominantType] || 'component';
  }

  /**
   * Expand a relationship cluster from a starting node
   * @private
   */
  private async expandRelationshipCluster(
    startNodeId: string,
    relationships: Record<string, Set<string>>,
    visitedNodes: Set<string>,
    minDensity: number
  ): Promise<Set<string>> {
    const cluster = new Set<string>([startNodeId]);
    visitedNodes.add(startNodeId);
    
    // Queue for breadth-first expansion
    const queue: string[] = [startNodeId];
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId) continue;
      
      // Get related nodes
      const relatedNodes = relationships[nodeId] || new Set();
      
      // For each related node
      for (const relatedId of relatedNodes) {
        // Skip already visited nodes
        if (visitedNodes.has(relatedId)) continue;
        
        // Calculate the relationship density if we add this node
        const densityWithNode = this.calculateClusterDensity(
          cluster, 
          relatedId, 
          relationships
        );
        
        // Only add the node if it maintains sufficient density
        if (densityWithNode >= minDensity) {
          cluster.add(relatedId);
          visitedNodes.add(relatedId);
          queue.push(relatedId);
        }
      }
    }
    
    return cluster;
  }

  /**
   * Calculate the relationship density of a cluster
   * @private
   */
  private calculateClusterDensity(
    cluster: Set<string>,
    candidateNodeId: string,
    relationships: Record<string, Set<string>>
  ): number {
    // Create a new set with the candidate node
    const expandedCluster = new Set([...cluster, candidateNodeId]);
    
    // Calculate the number of existing relationships within the expanded cluster
    let relationshipCount = 0;
    const totalPossibleRelationships = (expandedCluster.size * (expandedCluster.size - 1)) / 2;
    
    for (const nodeId of expandedCluster) {
      const relatedNodes = relationships[nodeId] || new Set();
      
      for (const relatedId of relatedNodes) {
        if (expandedCluster.has(relatedId) && relatedId !== nodeId) {
          relationshipCount++;
        }
      }
    }
    
    // Each relationship is counted twice (once from each end)
    relationshipCount /= 2;
    
    return totalPossibleRelationships > 0 ? 
      relationshipCount / totalPossibleRelationships : 0;
  }

  /**
   * Get the directory path from a file path
   * @private
   */
  private getDirectoryPath(filePath: string): string {
    const lastSlashIndex = filePath.lastIndexOf('/');
    return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
  }

  /**
   * Get the directory name from a directory path
   * @private
   */
  private getDirectoryName(dirPath: string): string {
    const lastSlashIndex = dirPath.lastIndexOf('/');
    return lastSlashIndex !== -1 ? dirPath.substring(lastSlashIndex + 1) : dirPath;
  }

  /**
   * Calculate the coherence of a directory based on its nodes
   * @private
   */
  private async evaluateDirectoryCoherence(
    nodeIds: string[],
    concepts: Concept[],
    understanding: CodebaseUnderstanding
  ): Promise<{ coherence: number, dominantConcepts: string[] }> {
    // Count concepts for these nodes
    const conceptCounts: Record<string, number> = {};
    
    for (const concept of concepts) {
      let overlapCount = 0;
      
      for (const nodeId of nodeIds) {
        if (concept.codeElements.includes(nodeId)) {
          overlapCount++;
        }
      }
      
      if (overlapCount > 0) {
        conceptCounts[concept.id] = overlapCount;
      }
    }
    
    // Find dominant concepts
    const sortedConcepts = Object.entries(conceptCounts)
      .sort(([, count1], [, count2]) => count2 - count1);
    
    // Calculate coverage
    const totalNodes = nodeIds.length;
    let coveredNodes = 0;
    
    // Take top 3 concepts
    const dominantConceptIds = sortedConcepts
      .slice(0, 3)
      .map(([id]) => id);
    
    // Calculate how many nodes are covered by dominant concepts
    const coveredNodeSet = new Set<string>();
    
    for (const conceptId of dominantConceptIds) {
      const concept = concepts.find(c => c.id === conceptId);
      if (concept) {
        for (const nodeId of concept.codeElements) {
          if (nodeIds.includes(nodeId)) {
            coveredNodeSet.add(nodeId);
          }
        }
      }
    }
    
    coveredNodes = coveredNodeSet.size;
    
    // Calculate name coherence
    const fileNames: string[] = [];
    for (const nodeId of nodeIds) {
      const node = understanding.codeNodes.get(nodeId);
      if (node && node.name) {
        fileNames.push(node.name);
      }
    }
    
    const nameCoherence = this.calculateNameSimilarity(fileNames);
    
    // Calculate relationship density
    const relationshipDensity = this.calculateDirectoryRelationshipDensity(
      nodeIds, 
      understanding
    );
    
    // Calculate overall coherence
    const coverageScore = totalNodes > 0 ? coveredNodes / totalNodes : 0;
    const coherence = (coverageScore * 0.5) + (nameCoherence * 0.2) + (relationshipDensity * 0.3);
    
    return {
      coherence,
      dominantConcepts: dominantConceptIds
    };
  }

  /**
   * Calculate the similarity between file names in a directory
   * @private
   */
  private calculateNameSimilarity(names: string[]): number {
    if (names.length < 2) return 0.5; // Default for too few names
    
    // Look for common patterns: prefixes, suffixes, words
    const commonPrefix = this.findLongestCommonPrefix(names);
    const commonSuffix = this.findLongestCommonSuffix(names);
    
    // Calculate similarity based on common patterns
    const prefixSimilarity = commonPrefix.length > 2 ? 
      Math.min(1, commonPrefix.length / 8) : 0;
    
    const suffixSimilarity = commonSuffix.length > 2 ? 
      Math.min(1, commonSuffix.length / 8) : 0;
    
    return Math.max(prefixSimilarity, suffixSimilarity, 0.1);
  }

  /**
   * Find the longest common prefix among strings
   * @private
   */
  private findLongestCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0] || '';
    
    // Sort strings to optimize comparison
    strings.sort();
    
    // Compare first and last string (after sorting)
    const first = strings[0] || '';
    const last = strings[strings.length - 1] || '';
    
    let i = 0;
    while (i < first.length && first.charAt(i) === last.charAt(i)) {
      i++;
    }
    
    return first.substring(0, i);
  }

  /**
   * Find the longest common suffix among strings
   * @private
   */
  private findLongestCommonSuffix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0] || '';
    
    // Reverse all strings
    const reversed = strings.map(s => 
      (s || '').split('').reverse().join('')
    );
    
    // Find the common prefix of reversed strings
    const commonReversedPrefix = this.findLongestCommonPrefix(reversed);
    
    // Reverse back to get the suffix
    return commonReversedPrefix.split('').reverse().join('');
  }

  /**
   * Calculate the relationship density within a directory
   * @private
   */
  private calculateDirectoryRelationshipDensity(
    nodeIds: string[],
    understanding: CodebaseUnderstanding
  ): number {
    if (nodeIds.length < 2) return 0.5; // Default for too few nodes
    
    let relationshipCount = 0;
    const totalPossibleRelationships = (nodeIds.length * (nodeIds.length - 1)) / 2;
    
    // Count relationships between nodes in this directory
    for (const relationship of understanding.relationships) {
      if (
        nodeIds.includes(relationship.sourceId) &&
        nodeIds.includes(relationship.targetId)
      ) {
        relationshipCount++;
      }
    }
    
    return totalPossibleRelationships > 0 ? 
      relationshipCount / totalPossibleRelationships : 0;
  }

  /**
   * Calculate text similarity between two strings
   * @private
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity of words
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));
    
    return this.calculateJaccardSimilarity(words1, words2);
  }

  /**
   * Find a common name pattern for nodes in a cluster
   * @private
   */
  private findCommonNamePattern(names: string[]): string {
    if (names.length === 0) return 'Component';
    
    // Try to find a common word across names
    const wordFrequency: Record<string, number> = {};
    
    for (const name of names) {
      const words = this.splitIdentifier(name);
      
      for (const word of words) {
        if (word.length <= 2 || this.isCommonWord(word)) continue;
        
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    }
    
    // Find the most frequent meaningful word
    let mostFrequentWord = '';
    let highestFreq = 0;
    
    for (const [word, freq] of Object.entries(wordFrequency)) {
      if (freq > highestFreq) {
        highestFreq = freq;
        mostFrequentWord = word;
      }
    }
    
    // If a common word is found in at least 1/3 of the names, use it
    if (mostFrequentWord && highestFreq >= Math.max(2, names.length / 3)) {
      return this.normalizeConceptName(mostFrequentWord) + ' Component';
    }
    
    // Otherwise, use the common prefix if meaningful
    const commonPrefix = this.findLongestCommonPrefix(names);
    if (commonPrefix.length >= 3 && !this.isCommonWord(commonPrefix)) {
      return this.normalizeConceptName(commonPrefix) + ' Component';
    }
    
    // Default to the first name if others fail
    return names[0] ? this.normalizeConceptName(names[0]) + ' Component' : 'Component';
  }
}