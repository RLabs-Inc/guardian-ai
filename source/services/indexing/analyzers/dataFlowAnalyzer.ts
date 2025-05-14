/**
 * DataFlowAnalyzer
 *
 * Discovers and analyzes data flows in codebases using an organic, assumption-free approach.
 * This analyzer follows the emergent indexing principles to detect how data moves through
 * a system without making assumptions about programming paradigms or code organization.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  EmergentAnalyzer,
  FileNode, 
  CodeNode,
  IndexingPhase,
  RelationshipType,
  CodeNodeType,
  DataNode,
  DataNodeRole,
  DataFlow,
  DataFlowGraph,
  DataFlowPath,
  DataFlowType
} from '../unifiedTypes.js';

import { SharedAnalysisContext } from '../sharedAnalysisContext.js';

/**
 * DataFlowAnalyzer discovers how data moves through a codebase by identifying
 * sources, transformers, sinks, and stores without making assumptions about
 * programming paradigms or code structure.
 */
export class DataFlowAnalyzer implements EmergentAnalyzer {
  // Core analyzer properties
  readonly id: string = 'data-flow-analyzer';
  readonly name: string = 'Data Flow Analyzer';
  readonly priority: number = 50; // Medium-low priority (runs after structural analyzers)
  readonly dependencies: string[] = ['language-detector', 'relationship-analyzer', 'pattern-analyzer'];
  
  // Internal state
  private nodeIdCounter: number = 0;
  private flowIdCounter: number = 0;
  private pathIdCounter: number = 0;
  private dataFlowGraph: DataFlowGraph = {
    nodes: new Map<string, DataNode>(),
    flows: [],
    paths: []
  };
  
  // Options
  private options = {
    maxDepth: 5,
    includeAsyncFlows: true,
    includeConditionalFlows: true,
    minConfidence: 0.6
  };

  /**
   * Initialize the data flow analyzer with the shared context
   */
  async initialize(context: SharedAnalysisContext): Promise<void> {
    // Reset state
    this.nodeIdCounter = 0;
    this.flowIdCounter = 0;
    this.pathIdCounter = 0;
    this.dataFlowGraph = {
      nodes: new Map<string, DataNode>(),
      flows: [],
      paths: []
    };
    
    // Initialize options from context
    if (context.options) {
      this.options = {
        maxDepth: context.options.maxDepth || this.options.maxDepth,
        includeAsyncFlows: context.options.includeAsyncFlows !== false,
        includeConditionalFlows: context.options.includeConditionalFlows !== false,
        minConfidence: context.options.dataFlowMinConfidence || this.options.minConfidence
      };
    }
    
    // Register data flow specific patterns
    this.registerDataFlowPatterns(context);
    
    context.recordEvent('analyzer-initialized', { analyzer: this.id });
  }

  /**
   * Analyze each file to identify potential data nodes
   */
  async analyzeFile(file: FileNode, _content: string, context: SharedAnalysisContext): Promise<void> {
    // Skip files without language - data flow analysis requires language detection
    if (!file.languageType) {
      return;
    }
    
    // Find code nodes from this file that might be data nodes
    for (const node of context.codeNodes.values()) {
      if (node.path === file.path) {
        // Process code element as a potential data node
        await this.processCodeElementForDataNodes(node, context);
      }
    }
  }

  /**
   * Process relationships to identify data flows
   */
  async processRelationships(context: SharedAnalysisContext): Promise<void> {
    if (context.currentPhase !== IndexingPhase.RELATIONSHIP_MAPPING) {
      return;
    }
    
    // Map existing relationships to data flows
    await this.identifyDataFlows(context);
    
    // Discover data flows through shared state access patterns
    await this.discoverSharedStateFlows(context);
    
    // Analyze function calls to identify parameter and return flows
    await this.analyzeFunctionCallFlows(context);
    
    // Discover asynchronous data flows if enabled
    if (this.options.includeAsyncFlows) {
      await this.discoverAsyncDataFlows(context);
    }
    
    context.recordEvent('data-flow-relationships-processed', {
      analyzer: this.id,
      flows: this.dataFlowGraph.flows.length
    });
  }

  /**
   * Discover data flow patterns
   */
  async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
    if (context.currentPhase !== IndexingPhase.PATTERN_DISCOVERY) {
      return;
    }
    
    // Discover data flow paths (sequences of flows that form meaningful paths)
    await this.discoverDataFlowPaths(context);
    
    // Analyze data type propagation
    await this.analyzeDataTypePropagation(context);
    
    // Detect data transformation patterns
    await this.detectDataTransformationPatterns(context);
    
    context.recordEvent('data-flow-patterns-discovered', {
      analyzer: this.id,
      flows: this.dataFlowGraph.flows.length,
      paths: this.dataFlowGraph.paths.length
    });
  }

  /**
   * Final integration of data flow analysis with the codebase understanding
   */
  async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
    if (context.currentPhase !== IndexingPhase.INTEGRATION) {
      return;
    }
    
    // Keep track of all added data flow relationships
    const addedRelationships = new Set<string>();
    
    // Create relationships from data flows for integration with the rest of the understanding
    for (const flow of this.dataFlowGraph.flows) {
      const sourceNode = this.dataFlowGraph.nodes.get(flow.sourceId);
      const targetNode = this.dataFlowGraph.nodes.get(flow.targetId);
      
      if (!sourceNode || !targetNode) continue;
      
      // Skip if either node doesn't have a code node reference
      if (!sourceNode.nodeId || !targetNode.nodeId) continue;
      
      // Create a unique key for this relationship to avoid duplicates
      const relationshipKey = `${sourceNode.nodeId}:${targetNode.nodeId}:dataflow:${flow.type}`;
      
      // Skip if we've already added this relationship
      if (addedRelationships.has(relationshipKey)) continue;
      
      // Add to the set to avoid duplicates
      addedRelationships.add(relationshipKey);
      
      // Create a relationship object
      context.relationships.push({
        id: uuidv4(),
        type: RelationshipType.DEPENDS_ON, // Use DEPENDS_ON since this is a data dependency
        sourceId: sourceNode.nodeId,
        targetId: targetNode.nodeId,
        metadata: {
          dataFlow: true,
          flowType: flow.type,
          async: flow.async,
          conditional: flow.conditional,
          transformations: flow.transformations
        },
        weight: flow.confidence, // Weight based on confidence
        confidence: flow.confidence
      });
    }
    
    // Update each code node with its data flow role
    for (const [_, dataNode] of this.dataFlowGraph.nodes.entries()) {
      if (dataNode.nodeId) {
        const codeNode = context.codeNodes.get(dataNode.nodeId);
        if (codeNode) {
          codeNode.metadata = codeNode.metadata || {};
          codeNode.metadata['dataFlowRole'] = dataNode.role;
          codeNode.metadata['dataNode'] = dataNode.id;
        }
      }
    }
    
    // Add data flow graph to the context
    context.understanding.dataFlow = this.dataFlowGraph;
    
    // Record metrics
    context.recordMetric('data_flow_nodes', this.dataFlowGraph.nodes.size);
    context.recordMetric('data_flow_flows', this.dataFlowGraph.flows.length);
    context.recordMetric('data_flow_paths', this.dataFlowGraph.paths.length);
    context.recordMetric('data_flow_sources', 
      Array.from(this.dataFlowGraph.nodes.values())
        .filter(n => n.role === DataNodeRole.SOURCE).length);
    context.recordMetric('data_flow_sinks', 
      Array.from(this.dataFlowGraph.nodes.values())
        .filter(n => n.role === DataNodeRole.SINK).length);
    context.recordMetric('data_flow_transformers', 
      Array.from(this.dataFlowGraph.nodes.values())
        .filter(n => n.role === DataNodeRole.TRANSFORMER).length);
    context.recordMetric('data_flow_stores', 
      Array.from(this.dataFlowGraph.nodes.values())
        .filter(n => n.role === DataNodeRole.STORE).length);
    
    context.recordEvent('data-flow-analysis-integrated', {
      analyzer: this.id,
      nodes: this.dataFlowGraph.nodes.size,
      flows: this.dataFlowGraph.flows.length,
      paths: this.dataFlowGraph.paths.length
    });
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Reset state to release memory
    this.dataFlowGraph = {
      nodes: new Map<string, DataNode>(),
      flows: [],
      paths: []
    };
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------
  
  /**
   * Register data flow specific patterns with the context
   */
  private registerDataFlowPatterns(context: SharedAnalysisContext): void {
    // Data source patterns
    context.registerPattern({
      type: 'data_source',
      name: 'Source naming pattern',
      description: 'Common naming patterns for data sources',
      regex: '(input|source|api|fetch|get|provider|read|load|create|generate)',
      confidence: 0.7
    });
    
    // Data sink patterns
    context.registerPattern({
      type: 'data_sink',
      name: 'Sink naming pattern',
      description: 'Common naming patterns for data sinks',
      regex: '(output|sink|save|write|send|emit|publish|dispatch|persist|set|update)',
      confidence: 0.7
    });
    
    // Data transformer patterns
    context.registerPattern({
      type: 'data_transformer',
      name: 'Transformer naming pattern',
      description: 'Common naming patterns for data transformers',
      regex: '(transform|convert|format|parse|map|process|filter|reduce|format|sanitize|normalize)',
      confidence: 0.7
    });
    
    // Data store patterns
    context.registerPattern({
      type: 'data_store',
      name: 'Store naming pattern',
      description: 'Common naming patterns for data stores',
      regex: '(store|state|cache|repository|db|database|storage|collection|model|container)',
      confidence: 0.7
    });
  }
  
  /**
   * Process a code element to identify if it's a data node
   */
  private async processCodeElementForDataNodes(element: CodeNode, context: SharedAnalysisContext): Promise<void> {
    // Determine data node role based on evidence
    const nodeRole = await this.determineDataNodeRole(element, context);
    if (nodeRole) {
      const node: DataNode = {
        id: `node_${this.generateNodeId()}`,
        name: element.name || element.id,
        nodeId: element.id,
        role: nodeRole,
        confidence: this.calculateNodeConfidence(element, nodeRole, context),
        metadata: {
          type: element.type,
          language: element.language,
          location: element.location,
        },
      };
      
      // Add data type information if available in metadata
      if (element.metadata && element.metadata['dataType']) {
        node.dataType = element.metadata['dataType'] as string;
      }
      
      this.dataFlowGraph.nodes.set(node.id, node);
    }
    
    // Recursively process child elements with depth control
    if (element.children && this.options.maxDepth > 0) {
      for (const child of element.children) {
        await this.processCodeElementForDataNodes(child, context);
      }
    }
  }
  
  /**
   * Determine the role of a data node based on its context and usage patterns
   */
  private async determineDataNodeRole(element: CodeNode, context: SharedAnalysisContext): Promise<DataNodeRole | null> {
    // Check explicit metadata if already known
    if (element.metadata && element.metadata['dataFlowRole']) {
      return element.metadata['dataFlowRole'] as DataNodeRole;
    }
    
    // Determine data node role based on organic discovery, not prescribed rules
    if (this.isLikelyDataSource(element, context)) {
      return DataNodeRole.SOURCE;
    } else if (this.isLikelyDataSink(element, context)) {
      return DataNodeRole.SINK;
    } else if (this.isLikelyDataTransformer(element, context)) {
      return DataNodeRole.TRANSFORMER;
    } else if (this.isLikelyDataStore(element, context)) {
      return DataNodeRole.STORE;
    }
    
    return null;
  }
  
  /**
   * Determine if an element is likely a data source
   */
  private isLikelyDataSource(element: CodeNode, context: SharedAnalysisContext): boolean {
    // Check explicit metadata
    if (element.metadata && element.metadata['isDataSource']) {
      return true;
    }
    
    // Check for pattern matches using findMatchingPatterns instead of matchPattern
    const sourcePatterns = context.findMatchingPatterns(element.name, 'data_source');
    if (sourcePatterns.length > 0) {
      return true;
    }
    
    // Check for source indicators in name
    const name = (element.name || '').toLowerCase();
    if (name.includes('input') || 
        name.includes('source') || 
        name.includes('api') || 
        name.includes('fetch') || 
        name.includes('get') || 
        name.startsWith('read') || 
        name.startsWith('load')) {
      return true;
    }
    
    // Check content for source indicators (if available)
    if (element.content) {
      const content = element.content.toLowerCase();
      if (content.includes('return') && 
          !content.includes('=') && 
          !content.includes('write') && 
          !content.includes('save')) {
        return true;
      }
    }
    
    // Check type
    if (element.type === CodeNodeType.FUNCTION || 
        element.type === CodeNodeType.METHOD) {
      // If function/method returns something but doesn't take many parameters, likely a source
      const hasParameters = element.children?.some(c => c.metadata && c.metadata['isParameter']);
      const hasReturnValue = element.children?.some(c => c.metadata && c.metadata['isReturn']) || 
                             element.content?.includes('return ');
      
      if (hasReturnValue && !hasParameters) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Determine if an element is likely a data sink
   */
  private isLikelyDataSink(element: CodeNode, context: SharedAnalysisContext): boolean {
    // Check explicit metadata
    if (element.metadata && element.metadata['isDataSink']) {
      return true;
    }
    
    // Check for pattern matches
    const sinkPatterns = context.findMatchingPatterns(element.name, 'data_sink');
    if (sinkPatterns.length > 0) {
      return true;
    }
    
    // Check for sink indicators in name
    const name = (element.name || '').toLowerCase();
    if (name.includes('output') || 
        name.includes('sink') || 
        name.includes('save') || 
        name.includes('write') || 
        name.includes('send') || 
        name.startsWith('set') || 
        name.startsWith('update')) {
      return true;
    }
    
    // Check content for sink indicators (if available)
    if (element.content) {
      const content = element.content.toLowerCase();
      if ((content.includes('write') || 
          content.includes('save') || 
          content.includes('emit(') || 
          content.includes('set')) && 
          !content.includes('return')) {
        return true;
      }
    }
    
    // Check type
    if (element.type === CodeNodeType.FUNCTION || 
        element.type === CodeNodeType.METHOD) {
      // If function/method takes parameters but doesn't return anything, likely a sink
      const hasParameters = element.children?.some(c => c.metadata && c.metadata['isParameter']);
      const hasReturnValue = element.children?.some(c => c.metadata && c.metadata['isReturn']) || 
                             element.content?.includes('return ');
      
      if (hasParameters && !hasReturnValue) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Determine if an element is likely a data transformer
   */
  private isLikelyDataTransformer(element: CodeNode, context: SharedAnalysisContext): boolean {
    // Check explicit metadata
    if (element.metadata && element.metadata['isDataTransformer']) {
      return true;
    }
    
    // Check for pattern matches
    const transformerPatterns = context.findMatchingPatterns(element.name, 'data_transformer');
    if (transformerPatterns.length > 0) {
      return true;
    }
    
    // Check for transformer indicators in name
    const name = (element.name || '').toLowerCase();
    if (name.includes('transform') || 
        name.includes('convert') || 
        name.includes('format') || 
        name.includes('parse') || 
        name.includes('map') || 
        name.includes('process') || 
        name.includes('filter')) {
      return true;
    }
    
    // Check content for transformer indicators (if available)
    if (element.content) {
      const content = element.content.toLowerCase();
      if (content.includes('return') && 
          (content.includes('map(') || 
           content.includes('filter(') || 
           content.includes('reduce(') || 
           content.includes('transform'))) {
        return true;
      }
    }
    
    // Check type
    if (element.type === CodeNodeType.FUNCTION || 
        element.type === CodeNodeType.METHOD) {
      // If function/method takes input and returns output, likely a transformer
      const hasParameters = element.children?.some(c => c.metadata && c.metadata['isParameter']);
      const hasReturnValue = element.children?.some(c => c.metadata && c.metadata['isReturn']) || 
                             element.content?.includes('return ');
      
      if (hasParameters && hasReturnValue) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Determine if an element is likely a data store
   */
  private isLikelyDataStore(element: CodeNode, context: SharedAnalysisContext): boolean {
    // Check explicit metadata
    if (element.metadata && element.metadata['isDataStore']) {
      return true;
    }
    
    // Check for pattern matches
    const storePatterns = context.findMatchingPatterns(element.name || '', 'data_store');
    if (storePatterns.length > 0) {
      return true;
    }
    
    // Check for store indicators in name
    const name = (element.name || '').toLowerCase();
    if (name.includes('store') || 
        name.includes('state') || 
        name.includes('cache') || 
        name.includes('repository') || 
        name.includes('db') || 
        name.includes('database')) {
      return true;
    }
    
    // Check type
    const type = element.type;
    if (type === CodeNodeType.CLASS || 
        type === CodeNodeType.INTERFACE) {
      // Classes/interfaces with both getter and setter methods are likely stores
      const hasGetters = element.children?.some(c => 
        (c.name && c.name.startsWith('get')) || 
        (c.metadata && c.metadata['isGetter']));
      
      const hasSetters = element.children?.some(c => 
        (c.name && c.name.startsWith('set')) || 
        (c.metadata && c.metadata['isSetter']));
      
      if (hasGetters && hasSetters) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate confidence for a data node role assignment
   */
  private calculateNodeConfidence(
    element: CodeNode, 
    role: DataNodeRole,
    context: SharedAnalysisContext
  ): number {
    // Base confidence
    let confidence = 0.7;
    
    // Increase confidence based on evidence
    
    // Pattern matches increase confidence
    const rolePatternType = `data_${role.toLowerCase()}`;
    const patternMatches = context.findMatchingPatterns(element.name || '', rolePatternType);
    
    if (patternMatches.length > 0) {
      // Get the highest confidence pattern match
      const maxConfidence = Math.max(...patternMatches.map(m => m.confidence));
      confidence = Math.max(confidence, maxConfidence);
    }
    
    // Direct role indicators increase confidence
    if (element.metadata && element.metadata['isDataSource'] && role === DataNodeRole.SOURCE) {
      confidence += 0.15;
    } else if (element.metadata && element.metadata['isDataSink'] && role === DataNodeRole.SINK) {
      confidence += 0.15;
    } else if (element.metadata && element.metadata['isDataTransformer'] && role === DataNodeRole.TRANSFORMER) {
      confidence += 0.15;
    } else if (element.metadata && element.metadata['isDataStore'] && role === DataNodeRole.STORE) {
      confidence += 0.15;
    }
    
    // Role name in element name increases confidence
    if (element.name?.toLowerCase().includes(role.toLowerCase())) {
      confidence += 0.1;
    }
    
    // Cap confidence at 0.95
    return Math.min(0.95, confidence);
  }
  
  /**
   * Identify data flows between nodes using existing relationships
   */
  private async identifyDataFlows(context: SharedAnalysisContext): Promise<void> {
    // Process all relationships to find potential data flows
    for (const relationship of context.relationships) {
      // Only process relevant relationship types that might represent data flow
      if (this.isDataFlowRelationship(relationship)) {
        const sourceNode = this.findDataNodeByElementId(relationship.sourceId);
        const targetNode = this.findDataNodeByElementId(relationship.targetId);
        
        if (sourceNode && targetNode) {
          const flowType = this.determineDataFlowType(relationship);
          const flow: DataFlow = {
            id: `flow_${this.generateFlowId()}`,
            type: flowType,
            sourceId: sourceNode.id,
            targetId: targetNode.id,
            transformations: this.extractTransformations(relationship),
            async: this.isAsyncFlow(relationship),
            conditional: this.isConditionalFlow(relationship),
            confidence: this.calculateFlowConfidence(relationship),
            metadata: {
              relationshipType: relationship.type,
              relationshipId: relationship.id,
              context: relationship.metadata ? relationship.metadata['context'] : undefined,
            },
          };
          
          // Only add flows that meet the confidence threshold
          if (flow.confidence >= this.options.minConfidence) {
            this.dataFlowGraph.flows.push(flow);
          }
        }
      }
    }
  }
  
  /**
   * Check if a relationship represents a data flow
   */
  private isDataFlowRelationship(relationship: any): boolean {
    // Direct data flow indicator
    if (relationship.metadata && relationship.metadata['dataFlow']) {
      return true;
    }
    
    // Examine relationship type
    const type = relationship.type;
    
    return type === RelationshipType.CALLS || 
           type === RelationshipType.IMPORTS || 
           type === RelationshipType.EXPORTS || 
           type === RelationshipType.USES || 
           type === RelationshipType.DEPENDS_ON || 
           type === RelationshipType.REFERENCES;
  }
  
  /**
   * Find a data node by its element ID
   */
  private findDataNodeByElementId(elementId: string): DataNode | null {
    for (const [_, node] of this.dataFlowGraph.nodes.entries()) {
      if (node.nodeId === elementId) {
        return node;
      }
    }
    
    return null;
  }
  
  /**
   * Determine the type of data flow from the relationship
   */
  private determineDataFlowType(relationship: any): DataFlowType {
    // Check if flow type is explicitly specified
    if (relationship.metadata && relationship.metadata['flowType']) {
      return relationship.metadata.flowType as DataFlowType;
    }
    
    // Check the relationship type for clues
    const type = relationship.type;
    
    if (type === RelationshipType.IMPORTS) {
      return DataFlowType.IMPORT;
    } else if (type === RelationshipType.EXPORTS) {
      return DataFlowType.EXPORT;
    } else if (type === RelationshipType.CALLS) {
      // Function calls could be parameter passing or return values
      // Check metadata for more specifics
      if (relationship.metadata && relationship.metadata['isParameterPass']) {
        return DataFlowType.PARAMETER;
      } else if (relationship.metadata && relationship.metadata['isReturnValue']) {
        return DataFlowType.RETURN;
      } else {
        return DataFlowType.METHOD_CALL;
      }
    } else if (type === RelationshipType.REFERENCES) {
      if (relationship.metadata && relationship.metadata['isPropertyAccess']) {
        return DataFlowType.PROPERTY_ACCESS;
      } else if (relationship.metadata && relationship.metadata['isAssignment']) {
        return DataFlowType.ASSIGNMENT;
      } else if (relationship.metadata && relationship.metadata['isEventEmission']) {
        return DataFlowType.EVENT_EMISSION;
      } else if (relationship.metadata && relationship.metadata['isEventHandling']) {
        return DataFlowType.EVENT_HANDLING;
      } else if (relationship.metadata && relationship.metadata['isStateMutation']) {
        return DataFlowType.STATE_MUTATION;
      }
    }
    
    // If context available, try to determine from context
    if (relationship.metadata && relationship.metadata['context']) {
      const context = relationship.metadata.context.toLowerCase();
      
      if (context.includes('=') && !context.includes('===') && !context.includes('!==')) {
        return DataFlowType.ASSIGNMENT;
      } else if (context.includes('function') && context.includes('(') && context.includes(')')) {
        return DataFlowType.METHOD_CALL;
      } else if (context.includes('emit') || context.includes('dispatch')) {
        return DataFlowType.EVENT_EMISSION;
      } else if (context.includes('listen') || context.includes('handler')) {
        return DataFlowType.EVENT_HANDLING;
      } else if (context.includes('.')) {
        return DataFlowType.PROPERTY_ACCESS;
      }
    }
    
    // Default to method call as most common
    return DataFlowType.METHOD_CALL;
  }
  
  /**
   * Extract transformations applied in this data flow
   */
  private extractTransformations(relationship: any): string[] {
    // If transformations already extracted, use those
    if (relationship.metadata && relationship.metadata['transformations']) {
      return relationship.metadata.transformations;
    }
    
    const transformations: string[] = [];
    
    // Extract from context if available
    if (relationship.metadata && relationship.metadata['context']) {
      const context = relationship.metadata.context.toLowerCase();
      
      // Look for common transformation methods
      if (context.includes('map(') || context.includes('.map(')) {
        transformations.push('map');
      }
      if (context.includes('filter(') || context.includes('.filter(')) {
        transformations.push('filter');
      }
      if (context.includes('reduce(') || context.includes('.reduce(')) {
        transformations.push('reduce');
      }
      if (context.includes('sort(') || context.includes('.sort(')) {
        transformations.push('sort');
      }
      if (context.includes('transform') || context.includes('convert')) {
        transformations.push('transform');
      }
      if (context.includes('parse') || context.includes('stringify')) {
        transformations.push('format');
      }
    }
    
    return transformations;
  }
  
  /**
   * Determine if a flow is asynchronous
   */
  private isAsyncFlow(relationship: any): boolean {
    // Check explicit indicator
    if (relationship.metadata && relationship.metadata['async'] !== undefined) {
      return relationship.metadata.async;
    }
    
    // Check context for async indicators
    if (relationship.metadata && relationship.metadata['context']) {
      const context = relationship.metadata.context.toLowerCase();
      
      return context.includes('async') ||
             context.includes('promise') ||
             context.includes('then(') ||
             context.includes('callback') ||
             context.includes('await') ||
             context.includes('eventlistener');
    }
    
    return false;
  }
  
  /**
   * Determine if a flow is conditional
   */
  private isConditionalFlow(relationship: any): boolean {
    // Check explicit indicator
    if (relationship.metadata && relationship.metadata['conditional'] !== undefined) {
      return relationship.metadata.conditional;
    }
    
    // Check context for conditional indicators
    if (relationship.metadata && relationship.metadata['context']) {
      const context = relationship.metadata.context.toLowerCase();
      
      return context.includes('if ') ||
             context.includes('else ') ||
             context.includes('switch') ||
             context.includes('case ') ||
             context.includes('try') ||
             context.includes('catch') ||
             context.includes('?') ||
             context.includes('||') ||
             context.includes('&&');
    }
    
    return false;
  }
  
  /**
   * Calculate confidence for a data flow
   */
  private calculateFlowConfidence(relationship: any): number {
    // Start with base confidence value
    let confidence = 0.65;
    
    // Direct type indicators increase confidence
    if (this.isDirectFlowType(relationship)) {
      confidence += 0.2;
    }
    
    // Context increases confidence
    if (relationship.metadata && relationship.metadata['context']) {
      confidence += 0.1;
    }
    
    // Relationship confidence affects data flow confidence
    if (relationship.confidence !== undefined) {
      // Weighted average with the relationship confidence
      confidence = (confidence + relationship.confidence) / 2;
    }
    
    // Cap confidence at 0.95
    return Math.min(0.95, confidence);
  }
  
  /**
   * Determine if a relationship directly indicates a data flow
   */
  private isDirectFlowType(relationship: any): boolean {
    // Check explicit metadata
    if (relationship.metadata && relationship.metadata['dataFlow']) {
      return true;
    }
    
    // Check for explicit flow indicators in metadata
    if ((relationship.metadata && relationship.metadata['isParameterPass']) ||
        (relationship.metadata && relationship.metadata['isReturnValue']) ||
        (relationship.metadata && relationship.metadata['isAssignment']) ||
        (relationship.metadata && relationship.metadata['isPropertyAccess']) ||
        (relationship.metadata && relationship.metadata['isEventEmission']) ||
        (relationship.metadata && relationship.metadata['isStateMutation'])) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Discover data flow paths by connecting sequences of flows
   */
  private async discoverDataFlowPaths(context: SharedAnalysisContext): Promise<void> {
    // Build a map of flows by source and target for efficient path discovery
    const flowsBySource = new Map<string, DataFlow[]>();
    const flowsByTarget = new Map<string, DataFlow[]>();
    
    for (const flow of this.dataFlowGraph.flows) {
      if (!flowsBySource.has(flow.sourceId)) {
        flowsBySource.set(flow.sourceId, []);
      }
      const sourceFlows = flowsBySource.get(flow.sourceId);
      if (sourceFlows) {
        sourceFlows.push(flow);
      }
      
      if (!flowsByTarget.has(flow.targetId)) {
        flowsByTarget.set(flow.targetId, []);
      }
      const targetFlows = flowsByTarget.get(flow.targetId);
      if (targetFlows) {
        targetFlows.push(flow);
      }
    }
    
    // Find entry points (sources with no incoming flows)
    const entryPoints: string[] = [];
    for (const [nodeId, node] of this.dataFlowGraph.nodes.entries()) {
      if (
        node.role === DataNodeRole.SOURCE &&
        (!flowsByTarget.has(nodeId) || flowsByTarget.get(nodeId)?.length === 0)
      ) {
        entryPoints.push(nodeId);
      }
    }
    
    // Discover paths from each entry point
    for (const entryPoint of entryPoints) {
      await this.discoverPathsFromNode(
        entryPoint,
        flowsBySource,
        new Set<string>(),
        [],
        context
      );
    }
    
    // Record event
    context.recordEvent('data-flow-paths-discovered', {
      analyzer: this.id,
      pathsCount: this.dataFlowGraph.paths.length,
      entryPoints: entryPoints.length
    });
  }
  
  /**
   * Recursively discover paths from a node
   */
  private async discoverPathsFromNode(
    nodeId: string,
    flowsBySource: Map<string, DataFlow[]>,
    visitedNodes: Set<string>,
    currentPath: string[],
    context: SharedAnalysisContext
  ): Promise<void> {
    // Prevent cycles
    if (visitedNodes.has(nodeId)) {
      return;
    }
    
    // Update path state
    visitedNodes.add(nodeId);
    currentPath.push(nodeId);
    
    // Check if this is a potential end of a meaningful path
    const node = this.dataFlowGraph.nodes.get(nodeId);
    if (
      node &&
      (node.role === DataNodeRole.SINK ||
        !flowsBySource.has(nodeId) ||
        flowsBySource.get(nodeId)?.length === 0)
    ) {
      // We've found a complete path from source to sink
      if (currentPath.length > 1) {
        // Create a data flow path
        const pathFlows = this.getFlowsForPath(currentPath);
        
        // Create path with null checks for potentially undefined values
        const entryPoint = currentPath[0];
        const exitPoint = currentPath[currentPath.length - 1];
        
        // Only create valid paths where we have entry and exit points
        if (entryPoint && exitPoint) {
          const path: DataFlowPath = {
            id: `path_${this.generatePathId()}`,
            name: this.generatePathName(currentPath),
            description: this.generatePathDescription(currentPath),
            nodes: [...currentPath],
            flows: pathFlows.map(flow => flow.id),
            entryPoints: [entryPoint],
            exitPoints: [exitPoint],
            confidence: this.calculatePathConfidence(pathFlows),
            metadata: {},
          };
          
          this.dataFlowGraph.paths.push(path);
        }
      }
    }
    
    // Continue path exploration if not at max depth
    if (currentPath.length < this.options.maxDepth && flowsBySource.has(nodeId)) {
      const sourceFlows = flowsBySource.get(nodeId);
      if (sourceFlows) {
        for (const flow of sourceFlows) {
          await this.discoverPathsFromNode(
            flow.targetId,
            flowsBySource,
            new Set(visitedNodes),
            [...currentPath],
            context
          );
        }
      }
    }
  }
  
  /**
   * Get all flows that connect the nodes in a path
   */
  private getFlowsForPath(nodePath: string[]): DataFlow[] {
    const flows: DataFlow[] = [];
    
    for (let i = 0; i < nodePath.length - 1; i++) {
      const sourceId = nodePath[i];
      const targetId = nodePath[i + 1];
      
      if (sourceId && targetId) {
        const flow = this.dataFlowGraph.flows.find(
          f => f.sourceId === sourceId && f.targetId === targetId,
        );
        if (flow) {
          flows.push(flow);
        }
      }
    }
    
    return flows;
  }
  
  /**
   * Generate a descriptive name for a data flow path
   */
  private generatePathName(nodePath: string[]): string {
    if (nodePath.length < 2) {
      return 'Empty path';
    }
    
    const sourceId = nodePath[0];
    const targetId = nodePath[nodePath.length - 1];
    
    if (!sourceId || !targetId) {
      return 'Invalid path';
    }
    
    const sourceNode = this.dataFlowGraph.nodes.get(sourceId);
    const targetNode = this.dataFlowGraph.nodes.get(targetId);
    
    if (!sourceNode || !targetNode) {
      return 'Unknown path';
    }
    
    return `${sourceNode.name} to ${targetNode.name}`;
  }
  
  /**
   * Generate a detailed description of a data flow path
   */
  private generatePathDescription(nodePath: string[]): string {
    if (nodePath.length < 2) {
      return 'Empty data flow path';
    }
    
    const sourceId = nodePath[0];
    const targetId = nodePath[nodePath.length - 1];
    
    if (!sourceId || !targetId) {
      return 'Invalid data flow path';
    }
    
    const sourceNode = this.dataFlowGraph.nodes.get(sourceId);
    const targetNode = this.dataFlowGraph.nodes.get(targetId);
    
    if (!sourceNode || !targetNode) {
      return 'Unknown data flow path';
    }
    
    let description = `Data flows from ${sourceNode.name} (${sourceNode.role}) to ${targetNode.name} (${targetNode.role})`;
    
    // Add intermediate nodes if present
    if (nodePath.length > 2) {
      description += ` through ${nodePath.length - 2} intermediate steps`;
    }
    
    // Add transformation info if available
    const flows = this.getFlowsForPath(nodePath);
    const transformations = flows
      .flatMap(flow => flow.transformations)
      .filter(t => t);
    
    if (transformations.length > 0) {
      description += ` with ${transformations.join(', ')} transformations`;
    }
    
    return description;
  }
  
  /**
   * Calculate the confidence of a path based on its component flows
   */
  private calculatePathConfidence(flows: DataFlow[]): number {
    if (flows.length === 0) {
      return 0;
    }
    
    // Average confidence of flows, with penalty for long paths
    const avgConfidence =
      flows.reduce((sum, flow) => sum + flow.confidence, 0) / flows.length;
    const lengthPenalty = Math.max(0, (flows.length - 2) * 0.03); // Longer paths are less certain
    
    return Math.max(0.5, Math.min(0.95, avgConfidence - lengthPenalty));
  }
  
  /**
   * Discover data flows through shared state access
   */
  private async discoverSharedStateFlows(context: SharedAnalysisContext): Promise<void> {
    // Identify elements that access the same state or variables
    const stateAccessMap = new Map<string, Set<string>>();
    
    // Build a map of which code elements access which state elements
    for (const relationship of context.relationships) {
      if (
        relationship.type === RelationshipType.REFERENCES ||
        relationship.type === RelationshipType.USES
      ) {
        // This is a state access relationship
        const targetId = relationship.targetId; // The state being accessed
        
        if (!stateAccessMap.has(targetId)) {
          stateAccessMap.set(targetId, new Set<string>());
        }
        
        // Add the accessing element to the set
        stateAccessMap.get(targetId)?.add(relationship.sourceId);
      }
    }
    
    // Create implicit flows between elements that access the same state
    for (const [stateId, accessors] of stateAccessMap.entries()) {
      if (accessors.size < 2) continue; // Need at least 2 accessors to create flows
      
      // Get or create data node for the shared state
      let stateDataNode = this.findDataNodeByElementId(stateId);
      
      // If no data node exists for this state, create one
      if (!stateDataNode) {
        stateDataNode = {
          id: `node_${this.generateNodeId()}`,
          name: `State_${stateId.split('-')[0]}`,
          nodeId: stateId,
          role: DataNodeRole.STORE,
          confidence: 0.7,
          metadata: {
            type: 'shared_state',
            implicit: true
          }
        };
        
        this.dataFlowGraph.nodes.set(stateDataNode.id, stateDataNode);
      }
      
      // For each accessor, create flows to and from the state
      for (const accessorId of accessors) {
        // Check if this is a read or write access based on code evidence
        const isWriteAccess = this.isLikelyWriteAccess(context, stateId, accessorId);
        
        // Find or create data node for the accessor
        let accessorDataNode = this.findDataNodeByElementId(accessorId);
        
        // If no data node exists, create one with an appropriate role
        if (!accessorDataNode) {
          const accessorRole = isWriteAccess ? DataNodeRole.SINK : DataNodeRole.SOURCE;
          
          accessorDataNode = {
            id: `node_${this.generateNodeId()}`,
            name: `Node_${accessorId.split('-')[0]}`,
            nodeId: accessorId,
            role: accessorRole,
            confidence: 0.7,
            metadata: {
              type: isWriteAccess ? 'writer' : 'reader',
              implicit: true
            }
          };
          
          this.dataFlowGraph.nodes.set(accessorDataNode.id, accessorDataNode);
        }
        
        // Create the flow (either to or from the state node)
        const flow: DataFlow = {
          id: `flow_${this.generateFlowId()}`,
          type: DataFlowType.STATE_MUTATION,
          sourceId: isWriteAccess ? accessorDataNode.id : stateDataNode.id,
          targetId: isWriteAccess ? stateDataNode.id : accessorDataNode.id,
          transformations: [],
          async: false,
          conditional: false,
          confidence: 0.7, // Moderate confidence for implicit flows
          metadata: {
            implicit: true,
            sharedState: true,
            type: isWriteAccess ? 'write' : 'read',
          },
        };
        
        // Only add if confidence meets threshold
        if (flow.confidence >= this.options.minConfidence) {
          this.dataFlowGraph.flows.push(flow);
        }
      }
    }
  }
  
  /**
   * Determine if a relationship likely represents a write access
   */
  private isLikelyWriteAccess(
    context: SharedAnalysisContext,
    stateId: string,
    accessorId: string
  ): boolean {
    // Look for evidence of write access in relationships
    for (const relationship of context.relationships) {
      if (
        relationship.sourceId === accessorId &&
        relationship.targetId === stateId
      ) {
        // Look for write indicators in metadata
        if (
          (relationship.metadata && relationship.metadata['isWrite']) ||
          (relationship.metadata && relationship.metadata['isAssignment']) ||
          (relationship.metadata && relationship.metadata['isUpdate']) ||
          (relationship.metadata && relationship.metadata['type'] === 'write')
        ) {
          return true;
        }
        
        // Examine context for write indicators
        const relationshipContext = relationship.metadata && relationship.metadata['context'];
        if (relationshipContext && typeof relationshipContext === 'string') {
          const contextLower = relationshipContext.toLowerCase();
          if (
            contextLower.includes('=') ||
            contextLower.includes('set') ||
            contextLower.includes('update') ||
            contextLower.includes('write') ||
            contextLower.includes('save')
          ) {
            return true;
          }
        }
      }
    }
    
    // Check if the accessor's name suggests write operation
    const accessorNode = context.codeNodes.get(accessorId);
    if (accessorNode && accessorNode.name) {
      const nameLower = accessorNode.name.toLowerCase();
      if (
        nameLower.startsWith('set') ||
        nameLower.includes('update') ||
        nameLower.includes('write') ||
        nameLower.includes('save') ||
        nameLower.includes('add')
      ) {
        return true;
      }
    }
    
    // Default to false if no clear evidence of write
    return false;
  }
  
  /**
   * Analyze function calls to identify parameter and return flows
   */
  private async analyzeFunctionCallFlows(context: SharedAnalysisContext): Promise<void> {
    // Find all relationships that represent function calls
    const callRelationships = context.relationships.filter(
      rel => rel.type === RelationshipType.CALLS
    );
    
    // Process each call to find parameter and return flows
    for (const relationship of callRelationships) {
      const callerNode = context.codeNodes.get(relationship.sourceId);
      const calleeNode = context.codeNodes.get(relationship.targetId);
      
      if (!callerNode || !calleeNode) continue;
      
      // Find or create data nodes for caller and callee
      let callerDataNode = this.findDataNodeByElementId(callerNode.id);
      if (!callerDataNode) {
        // Infer a role based on context
        const callerRole = this.inferNodeRole(callerNode, context);
        
        callerDataNode = {
          id: `node_${this.generateNodeId()}`,
          name: callerNode.name,
          nodeId: callerNode.id,
          role: callerRole,
          confidence: 0.7,
          metadata: {
            type: callerNode.type,
            language: callerNode.language
          }
        };
        
        this.dataFlowGraph.nodes.set(callerDataNode.id, callerDataNode);
      }
      
      let calleeDataNode = this.findDataNodeByElementId(calleeNode.id);
      if (!calleeDataNode) {
        // Infer a role based on context
        const calleeRole = this.inferNodeRole(calleeNode, context);
        
        calleeDataNode = {
          id: `node_${this.generateNodeId()}`,
          name: calleeNode.name,
          nodeId: calleeNode.id,
          role: calleeRole,
          confidence: 0.7,
          metadata: {
            type: calleeNode.type,
            language: calleeNode.language
          }
        };
        
        this.dataFlowGraph.nodes.set(calleeDataNode.id, calleeDataNode);
      }
      
      // Create parameter flows if function has parameters
      if (calleeNode.children?.some(child => 
        (child.metadata && child.metadata['isParameter']) || 
        (child.type as string) === 'parameter'
      )) {
        // Find parameter nodes
        const parameterNodes = calleeNode.children?.filter(child => 
          (child.metadata && child.metadata['isParameter']) || 
          (child.type as string) === 'parameter'
        ) || [];
        
        // For each parameter, try to identify the argument source
        for (const paramNode of parameterNodes) {
          // Get parameter data node
          let paramDataNode = this.findDataNodeByElementId(paramNode.id);
          if (!paramDataNode) {
            paramDataNode = {
              id: `node_${this.generateNodeId()}`,
              name: paramNode.name || `Param_${paramNode.id.split('-')[0]}`,
              nodeId: paramNode.id,
              role: DataNodeRole.TRANSFORMER,
              confidence: 0.7,
              metadata: {
                type: 'parameter',
                language: paramNode.language
              }
            };
            
            this.dataFlowGraph.nodes.set(paramDataNode.id, paramDataNode);
          }
          
          // Create the parameter flow from caller to parameter
          const paramFlow: DataFlow = {
            id: `flow_${this.generateFlowId()}`,
            type: DataFlowType.PARAMETER,
            sourceId: callerDataNode.id,
            targetId: paramDataNode.id,
            transformations: [],
            async: this.isAsyncFlow(relationship),
            conditional: this.isConditionalFlow(relationship),
            confidence: 0.7,
            metadata: {
              functionCall: true,
              callerId: callerNode.id,
              calleeId: calleeNode.id,
              parameterName: paramNode.name
            }
          };
          
          // Only add if confidence meets threshold
          if (paramFlow.confidence >= this.options.minConfidence) {
            this.dataFlowGraph.flows.push(paramFlow);
          }
        }
      }
      
      // Create return flow if function likely returns data
      const returnsData = 
        (calleeNode.metadata && calleeNode.metadata['returns']) || 
        calleeNode.children?.some(child => child.metadata && child.metadata['isReturn']) ||
        (calleeNode.content && calleeNode.content.includes('return '));
      
      if (returnsData) {
        // Create the return flow from callee to caller
        const returnFlow: DataFlow = {
          id: `flow_${this.generateFlowId()}`,
          type: DataFlowType.RETURN,
          sourceId: calleeDataNode.id,
          targetId: callerDataNode.id,
          transformations: [],
          async: this.isAsyncFlow(relationship),
          conditional: this.isConditionalFlow(relationship),
          confidence: 0.75,
          metadata: {
            functionCall: true,
            returnFlow: true,
            callerId: callerNode.id,
            calleeId: calleeNode.id
          }
        };
        
        // Only add if confidence meets threshold
        if (returnFlow.confidence >= this.options.minConfidence) {
          this.dataFlowGraph.flows.push(returnFlow);
        }
      }
    }
  }
  
  /**
   * Infer a data node role for a code node based on context
   */
  private inferNodeRole(node: CodeNode, context: SharedAnalysisContext): DataNodeRole {
    // Use existing role if already determined
    const existingNode = this.findDataNodeByElementId(node.id);
    if (existingNode) {
      return existingNode.role;
    }
    
    // Check for explicit data flow role in metadata
    if (node.metadata && node.metadata['dataFlowRole']) {
      return node.metadata['dataFlowRole'] as DataNodeRole;
    }
    
    // Infer a role based on node characteristics
    if (this.isLikelyDataSource(node, context)) {
      return DataNodeRole.SOURCE;
    } else if (this.isLikelyDataSink(node, context)) {
      return DataNodeRole.SINK;
    } else if (this.isLikelyDataTransformer(node, context)) {
      return DataNodeRole.TRANSFORMER;
    } else if (this.isLikelyDataStore(node, context)) {
      return DataNodeRole.STORE;
    }
    
    // Default role based on node type
    if (node.type === CodeNodeType.FUNCTION || node.type === CodeNodeType.METHOD) {
      // Functions/methods are most commonly transformers
      return DataNodeRole.TRANSFORMER;
    } else if (node.type === CodeNodeType.VARIABLE || node.type === CodeNodeType.CONSTANT) {
      // Variables/constants are most commonly sources
      return DataNodeRole.SOURCE;
    } else if (node.type === CodeNodeType.CLASS || node.type === CodeNodeType.INTERFACE) {
      // Classes/interfaces are most commonly stores
      return DataNodeRole.STORE;
    }
    
    // Default to transformer
    return DataNodeRole.TRANSFORMER;
  }
  
  /**
   * Discover asynchronous data flows such as events
   */
  private async discoverAsyncDataFlows(context: SharedAnalysisContext): Promise<void> {
    // Find event emission and handling patterns
    const eventPatterns = [
      {regex: /emit\s*\(/i, type: 'emission'},
      {regex: /dispatch\s*\(/i, type: 'emission'},
      {regex: /publish\s*\(/i, type: 'emission'},
      {regex: /on\s*\(\s*['"]/i, type: 'handling'},
      {regex: /addEventListener\s*\(/i, type: 'handling'},
      {regex: /subscribe\s*\(/i, type: 'handling'},
      {regex: /listener|handler|callback/i, type: 'handling'}
    ];
    
    // Track event emitters and handlers by event name
    const eventEmitters = new Map<string, string[]>();
    const eventHandlers = new Map<string, string[]>();
    
    // Analyze nodes for event patterns
    for (const [nodeId, node] of context.codeNodes.entries()) {
      if (!node.content) continue;
      
      // Check content for event patterns
      for (const pattern of eventPatterns) {
        if (pattern.regex.test(node.content)) {
          // Extract potential event names using a simple heuristic
          const eventNames = this.extractEventNames(node.content);
          
          for (const eventName of eventNames) {
            // Skip meaningless event names
            if (eventName.length < 3) continue;
            
            if (pattern.type === 'emission') {
              if (!eventEmitters.has(eventName)) {
                eventEmitters.set(eventName, []);
              }
              eventEmitters.get(eventName)?.push(nodeId);
            } else {
              if (!eventHandlers.has(eventName)) {
                eventHandlers.set(eventName, []);
              }
              eventHandlers.get(eventName)?.push(nodeId);
            }
          }
        }
      }
    }
    
    // Create data flows between emitters and handlers
    for (const [eventName, emitterIds] of eventEmitters.entries()) {
      const handlerIds = eventHandlers.get(eventName) || [];
      
      // Skip if no handlers for this event
      if (handlerIds.length === 0) continue;
      
      // Create flows from each emitter to each handler
      for (const emitterId of emitterIds) {
        // Find or create data node for emitter
        let emitterDataNode = this.findDataNodeByElementId(emitterId);
        if (!emitterDataNode) {
          const emitterNode = context.codeNodes.get(emitterId);
          if (!emitterNode) continue;
          
          emitterDataNode = {
            id: `node_${this.generateNodeId()}`,
            name: emitterNode.name,
            nodeId: emitterId,
            role: DataNodeRole.SOURCE,
            confidence: 0.75,
            metadata: {
              type: emitterNode.type,
              eventEmitter: true,
              eventName
            }
          };
          
          this.dataFlowGraph.nodes.set(emitterDataNode.id, emitterDataNode);
        }
        
        for (const handlerId of handlerIds) {
          // Find or create data node for handler
          let handlerDataNode = this.findDataNodeByElementId(handlerId);
          if (!handlerDataNode) {
            const handlerNode = context.codeNodes.get(handlerId);
            if (!handlerNode) continue;
            
            handlerDataNode = {
              id: `node_${this.generateNodeId()}`,
              name: handlerNode.name,
              nodeId: handlerId,
              role: DataNodeRole.SINK,
              confidence: 0.75,
              metadata: {
                type: handlerNode.type,
                eventHandler: true,
                eventName
              }
            };
            
            this.dataFlowGraph.nodes.set(handlerDataNode.id, handlerDataNode);
          }
          
          // Create event flow
          const flow: DataFlow = {
            id: `flow_${this.generateFlowId()}`,
            type: DataFlowType.EVENT_EMISSION,
            sourceId: emitterDataNode.id,
            targetId: handlerDataNode.id,
            transformations: [],
            async: true, // Events are inherently asynchronous
            conditional: false,
            confidence: 0.7,
            metadata: {
              eventName,
              eventFlow: true
            }
          };
          
          // Only add if confidence meets threshold
          if (flow.confidence >= this.options.minConfidence) {
            this.dataFlowGraph.flows.push(flow);
          }
        }
      }
    }
  }
  
  /**
   * Extract potential event names from content
   */
  private extractEventNames(content: string): string[] {
    const eventNames = new Set<string>();
    
    // Extract event names from common patterns
    // emit('eventName') or on('eventName')
    const quotes = ["'", '"', '`'];
    for (const quote of quotes) {
      const regex = new RegExp(`(emit|on|dispatch|addEventListener|subscribe)\\s*\\(\\s*${quote}([^${quote}]+)${quote}`, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const eventName = match[2];
        if (eventName) {
          eventNames.add(eventName);
        }
      }
    }
    
    // Extract from variable names that look like events
    const varRegex = /\b(on|handle|event)([A-Z][a-zA-Z0-9]*)\b/g;
    let varMatch;
    while ((varMatch = varRegex.exec(content)) !== null) {
      // Convert from onEventName to eventName
      let eventName = varMatch[2];
      if (eventName) {
        eventName = eventName.charAt(0).toLowerCase() + eventName.slice(1);
      }
      if (eventName) {
        eventNames.add(eventName);
      }
    }
    
    return Array.from(eventNames);
  }
  
  /**
   * Analyze data type propagation through the flow graph
   */
  private async analyzeDataTypePropagation(context: SharedAnalysisContext): Promise<void> {
    // Look for data type information in code nodes
    for (const [_nodeId, dataNode] of this.dataFlowGraph.nodes.entries()) {
      if (!dataNode.nodeId) continue;
      
      const codeNode = context.codeNodes.get(dataNode.nodeId);
      if (!codeNode) continue;
      
      // Extract data type information from metadata
      if (codeNode.metadata && codeNode.metadata['dataType']) {
        dataNode.dataType = codeNode.metadata['dataType'];
      } else if (codeNode.metadata && codeNode.metadata['type']) {
        dataNode.dataType = codeNode.metadata['type'];
      }
    }
    
    // Propagate data types along flows (simple version)
    // In a full implementation, this would be more sophisticated
    let changed = true;
    const maxIterations = 3; // Limit iterations to prevent infinite loops
    let iteration = 0;
    
    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;
      
      for (const flow of this.dataFlowGraph.flows) {
        const sourceNode = this.dataFlowGraph.nodes.get(flow.sourceId);
        const targetNode = this.dataFlowGraph.nodes.get(flow.targetId);
        
        if (sourceNode && targetNode && sourceNode.dataType && !targetNode.dataType) {
          // Propagate type from source to target, potentially modified by transformations
          targetNode.dataType = this.transformDataType(sourceNode.dataType, flow.transformations);
          changed = true;
        }
      }
    }
  }
  
  /**
   * Transform a data type based on transformations
   */
  private transformDataType(dataType: string, transformations: string[]): string {
    // Simple heuristic for how transformations affect data types
    if (transformations.includes('map')) {
      if (dataType.includes('[]')) {
        // Array transformations
        return dataType; // Preserves array type
      } else {
        // Non-array might become array
        return `${dataType}[]`;
      }
    } else if (transformations.includes('filter')) {
      // Filter preserves type
      return dataType;
    } else if (transformations.includes('reduce')) {
      // Reduce might change array to single value
      if (dataType.includes('[]')) {
        return dataType.replace('[]', '');
      }
    } else if (transformations.includes('transform') || 
               transformations.includes('format')) {
      // Format might change to string
      return 'string';
    }
    
    // Default: no change
    return dataType;
  }
  
  /**
   * Detect data transformation patterns in flows
   */
  private async detectDataTransformationPatterns(context: SharedAnalysisContext): Promise<void> {
    // Group flows by their transformations
    const transformationGroups = new Map<string, DataFlow[]>();
    
    for (const flow of this.dataFlowGraph.flows) {
      if (flow.transformations && flow.transformations.length > 0) {
        const key = flow.transformations.join(',');
        if (!transformationGroups.has(key)) {
          transformationGroups.set(key, []);
        }
        transformationGroups.get(key)?.push(flow);
      }
    }
    
    // Register transformation patterns for any significant groups
    for (const [transform, flows] of transformationGroups.entries()) {
      if (flows.length >= 3) { // Only consider patterns with multiple instances
        context.registerPattern({
          type: 'data_transformation',
          name: `${transform} transformation pattern`,
          description: `Common pattern of applying ${transform} transformations to data`,
          confidence: 0.8,
          metadata: {
            transformations: transform.split(','),
            flowCount: flows.length
          }
        });
      }
    }
  }
  
  /**
   * Generate unique IDs for data flow elements
   */
  private generateNodeId(): string {
    return (++this.nodeIdCounter).toString();
  }
  
  private generateFlowId(): string {
    return (++this.flowIdCounter).toString();
  }
  
  private generatePathId(): string {
    return (++this.pathIdCounter).toString();
  }
}