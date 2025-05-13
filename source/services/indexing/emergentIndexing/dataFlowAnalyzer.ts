/**
 * DataFlowAnalyzer
 *
 * Discovers and analyzes data flows in codebases using an organic, assumption-free approach.
 * This analyzer follows the emergent indexing principles to detect how data moves through
 * a system without making assumptions about programming paradigms or code organization.
 */

import {
	CodebaseUnderstanding,
	DataFlow,
	DataFlowGraph,
	DataFlowPath,
	DataFlowType,
	DataNode,
	DataNodeRole,
	RelationshipType,
	CodeNodeType,
	CodeNode,
	CodeElement,
} from './types.js';
import {PatternDiscovery} from './patternDiscovery.js';

export class DataFlowAnalyzer {
	// We're not using patternDiscovery directly but keeping it for future pattern matching
	// @ts-ignore: Will be used in future implementations
	private readonly patternDiscovery: PatternDiscovery;
	private nodeIdCounter: number = 0;
	private flowIdCounter: number = 0;
	private pathIdCounter: number = 0;

	constructor(patternDiscovery?: PatternDiscovery) {
		this.patternDiscovery = patternDiscovery || new PatternDiscovery();
	}

	/**
	 * Analyzes data flows in the codebase and builds a comprehensive data flow graph
	 */
	public async analyzeDataFlows(
		understanding: CodebaseUnderstanding,
		options?: {
			maxDepth?: number;
			includeAsyncFlows?: boolean;
			includeConditionalFlows?: boolean;
			minConfidence?: number;
		},
	): Promise<DataFlowGraph> {
		const opts = {
			maxDepth: options?.maxDepth || 5,
			includeAsyncFlows: options?.includeAsyncFlows !== false,
			includeConditionalFlows: options?.includeConditionalFlows !== false,
			minConfidence: options?.minConfidence || 0.6,
		};

		// Initialize data flow graph
		const dataFlowGraph: DataFlowGraph = {
			nodes: new Map<string, DataNode>(),
			flows: [],
			paths: [],
		};

		// Step 1: Discover data nodes (sources, transformers, sinks)
		await this.discoverDataNodes(understanding, dataFlowGraph, opts);

		// Step 2: Identify data flows between nodes
		await this.identifyDataFlows(understanding, dataFlowGraph, opts);

		// Step 3: Discover data flow paths (sequences of flows that form meaningful paths)
		await this.discoverDataFlowPaths(dataFlowGraph, opts);

		// Step 4: Enrich with semantic analysis
		await this.enrichWithSemanticAnalysis(understanding, dataFlowGraph);

		return dataFlowGraph;
	}

	/**
	 * Discovers data nodes by identifying variables, parameters, returns,
	 * and other data elements through organic pattern recognition
	 */
	private async discoverDataNodes(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		options: any,
	): Promise<void> {
		// Extract code elements if they aren't already present
		// Following the organic discovery principle - we adapt to whatever structure we find
		let elements: CodeElement[] = [];

		if (understanding.elements && understanding.elements.length > 0) {
			// Use existing elements if available
			elements = understanding.elements;
		} else {
			// Convert codeNodes to CodeElements for data flow analysis
			// Being adaptive to what's available in the codebase
			elements = Array.from(understanding.codeNodes.values()).map(node => {
				return {
					id: node.id,
					name: node.name,
					type: node.type,
					location: node.location,
					content: node.content,
					category:
						typeof node.type === 'string' ? node.type : String(node.type),
					children: node.children?.map(
						child =>
							({
								id: child.id,
								name: child.name,
								type: child.type,
								metadata: {...child.metadata},
							} as CodeElement),
					),
					metadata: {...node.metadata},
				} as CodeElement;
			});

			// Store for future reference
			understanding.elements = elements;
		}
		for (const element of elements) {
			// Process different types of code elements to find data nodes
			await this.processCodeElementForDataNodes(
				element,
				dataFlowGraph,
				options,
			);

			// Recursively process child elements with depth control
			if (element.children && options.maxDepth > 0) {
				for (const child of element.children) {
					await this.processCodeElementForDataNodes(child, dataFlowGraph, {
						...options,
						maxDepth: options.maxDepth - 1,
					});
				}
			}
		}

		// Analyze naming patterns to improve node role detection
		await this.analyzeNamingPatternsForDataRoles(dataFlowGraph);
	}

	/**
	 * Process a code element to extract data nodes
	 */
	private async processCodeElementForDataNodes(
		element: CodeElement,
		dataFlowGraph: DataFlowGraph,
		_options: any, // Unused but kept for API consistency
	): Promise<void> {
		// Extract data elements based on context and code patterns
		const nodeRole = await this.determineDataNodeRole(element);
		if (nodeRole) {
			const node: DataNode = {
				id: `node_${this.generateNodeId()}`,
				name: element.name || element.id,
				nodeId: element.id,
				role: nodeRole,
				confidence: this.calculateNodeConfidence(element, nodeRole),
				metadata: {
					type: element.type,
					category: element.category,
					location: element.location,
				},
			};

			if (element.dataType) {
				node.dataType = element.dataType;
			}

			dataFlowGraph.nodes.set(node.id, node);
		}
	}

	/**
	 * Determine the role of a data node based on its context and usage patterns
	 */
	private async determineDataNodeRole(
		element: CodeElement,
	): Promise<DataNodeRole | null> {
		// Determine data node role based on organic discovery, not prescribed rules
		if (this.isLikelyDataSource(element)) {
			return DataNodeRole.SOURCE;
		} else if (this.isLikelyDataSink(element)) {
			return DataNodeRole.SINK;
		} else if (this.isLikelyDataTransformer(element)) {
			return DataNodeRole.TRANSFORMER;
		} else if (this.isLikelyDataStore(element)) {
			return DataNodeRole.STORE;
		}

		return null;
	}

	/**
	 * Identify data flows between nodes by analyzing code relationships
	 */
	private async identifyDataFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		options: any,
	): Promise<void> {
		// Find direct data flows from explicit references
		await this.findDirectDataFlows(understanding, dataFlowGraph, options);

		// Discover implicit data flows through pattern analysis
		await this.discoverImplicitDataFlows(understanding, dataFlowGraph, options);

		// Analyze function calls to identify parameter and return flows
		await this.analyzeFunctionCallFlows(understanding, dataFlowGraph, options);

		if (options.includeAsyncFlows) {
			// Discover asynchronous data flows (events, promises, callbacks)
			await this.discoverAsyncDataFlows(understanding, dataFlowGraph, options);
		}
	}

	/**
	 * Find direct data flows from explicit references in the code
	 */
	private async findDirectDataFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		options: any,
	): Promise<void> {
		// Iterate through relationships to find data flows
		const relationships = understanding.relationships || [];
		for (const relationship of relationships) {
			// Only process relevant relationship types
			if (this.isDataFlowRelationship(relationship)) {
				const sourceNode = this.findDataNodeByElementId(
					dataFlowGraph,
					relationship.sourceId,
				);
				const targetNode = this.findDataNodeByElementId(
					dataFlowGraph,
					relationship.targetId,
				);

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
							context: relationship.metadata ? relationship.metadata['context'] : undefined,
						},
					};

					// Only add flows that meet the confidence threshold
					if (flow.confidence >= options.minConfidence) {
						dataFlowGraph.flows.push(flow);
					}
				}
			}
		}
	}

	/**
	 * Discover data flow paths by connecting sequences of flows
	 */
	private async discoverDataFlowPaths(
		dataFlowGraph: DataFlowGraph,
		options: any,
	): Promise<void> {
		// Build a map of flows by source and target for efficient path discovery
		const flowsBySource = new Map<string, DataFlow[]>();
		const flowsByTarget = new Map<string, DataFlow[]>();

		for (const flow of dataFlowGraph.flows) {
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
		for (const [nodeId, node] of dataFlowGraph.nodes.entries()) {
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
				dataFlowGraph,
				flowsBySource,
				new Set<string>(),
				[],
				options,
			);
		}
	}

	/**
	 * Recursively discover paths from a node
	 */
	private async discoverPathsFromNode(
		nodeId: string,
		dataFlowGraph: DataFlowGraph,
		flowsBySource: Map<string, DataFlow[]>,
		visitedNodes: Set<string>,
		currentPath: string[],
		options: any,
	): Promise<void> {
		// Prevent cycles
		if (visitedNodes.has(nodeId)) {
			return;
		}

		// Update path state
		visitedNodes.add(nodeId);
		currentPath.push(nodeId);

		// Check if this is a potential end of a meaningful path
		const node = dataFlowGraph.nodes.get(nodeId);
		if (
			node &&
			(node.role === DataNodeRole.SINK ||
				!flowsBySource.has(nodeId) ||
				flowsBySource.get(nodeId)?.length === 0)
		) {
			// We've found a complete path from source to sink
			if (currentPath.length > 1) {
				// Create a data flow path
				const pathFlows = this.getFlowsForPath(currentPath, dataFlowGraph);

				// Create path with null checks for potentially undefined values
				const entryPoint = currentPath[0];
				const exitPoint = currentPath[currentPath.length - 1];

				// Only create valid paths where we have entry and exit points
				if (entryPoint && exitPoint) {
					const path: DataFlowPath = {
						id: `path_${this.generatePathId()}`,
						name: this.generatePathName(currentPath, dataFlowGraph),
						description: this.generatePathDescription(
							currentPath,
							dataFlowGraph,
						),
						nodes: [...currentPath],
						flows: pathFlows.map(flow => flow.id),
						entryPoints: [entryPoint],
						exitPoints: [exitPoint],
						confidence: this.calculatePathConfidence(pathFlows),
						metadata: {},
					};

					dataFlowGraph.paths.push(path);
				}
			}
		}

		// Continue path exploration if not at max depth
		if (currentPath.length < options.maxDepth && flowsBySource.has(nodeId)) {
			const sourceFlows = flowsBySource.get(nodeId);
			if (sourceFlows) {
				for (const flow of sourceFlows) {
					await this.discoverPathsFromNode(
						flow.targetId,
						dataFlowGraph,
						flowsBySource,
						new Set(visitedNodes),
						[...currentPath],
						options,
					);
				}
			}
		}
	}

	/**
	 * Enrich the data flow graph with semantic analysis
	 */
	private async enrichWithSemanticAnalysis(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
	): Promise<void> {
		// Analyze data type propagation
		await this.analyzeDataTypePropagation(dataFlowGraph);

		// Detect data transformation patterns
		await this.detectDataTransformationPatterns(dataFlowGraph);

		// Identify common data flow patterns
		await this.identifyCommonDataFlowPatterns(understanding, dataFlowGraph);
	}

	// Utility methods

	private isLikelyDataSource(element: CodeElement): boolean {
		// Check if element is likely a data source based on patterns
		return Boolean(
			element.isDataSource ||
				this.hasSourceIndicators(element) ||
				this.checkPatternMatches(element, 'data_source'),
		);
	}

	private isLikelyDataSink(element: CodeElement): boolean {
		// Check if element is likely a data sink based on patterns
		return Boolean(
			element.isDataSink ||
				this.hasSinkIndicators(element) ||
				this.checkPatternMatches(element, 'data_sink'),
		);
	}

	private isLikelyDataTransformer(element: CodeElement): boolean {
		// Check if element is likely a data transformer based on patterns
		return Boolean(
			element.isDataTransformer ||
				this.hasTransformerIndicators(element) ||
				this.checkPatternMatches(element, 'data_transformer'),
		);
	}

	private isLikelyDataStore(element: CodeElement): boolean {
		// Check if element is likely a data store based on patterns
		return Boolean(
			element.isDataStore ||
				this.hasStoreIndicators(element) ||
				this.checkPatternMatches(element, 'data_store'),
		);
	}

	private checkPatternMatches(
		element: CodeElement,
		patternType: string,
	): boolean {
		// Placeholder for pattern matching - in a real implementation, this would use the pattern discovery service
		// Since patternDiscovery.matchesPattern doesn't exist, we'll implement a simplified check

		const name = (element.name || '').toLowerCase();
		const type = (element.type || '').toLowerCase();

		switch (patternType) {
			case 'data_source':
				return (
					name.includes('source') ||
					name.includes('provider') ||
					name.includes('input')
				);
			case 'data_sink':
				return (
					name.includes('sink') ||
					name.includes('output') ||
					name.includes('writer')
				);
			case 'data_transformer':
				return (
					name.includes('transform') ||
					name.includes('converter') ||
					name.includes('processor')
				);
			case 'data_store':
				return (
					name.includes('store') ||
					name.includes('repository') ||
					type.includes('store')
				);
			default:
				return false;
		}
	}

	private hasSourceIndicators(element: CodeElement): boolean {
		// Look for patterns indicating a data source (inputs, APIs, etc.)
		const name = (element.name || '').toLowerCase();
		const content = (element.content || '').toLowerCase();

		return (
			name.includes('input') ||
			name.includes('source') ||
			name.includes('api') ||
			name.includes('fetch') ||
			name.includes('get') ||
			content.includes('return') ||
			content.includes('resolve(')
		);
	}

	private hasSinkIndicators(element: CodeElement): boolean {
		// Look for patterns indicating a data sink (outputs, storage, etc.)
		const name = (element.name || '').toLowerCase();
		const content = (element.content || '').toLowerCase();

		return (
			name.includes('output') ||
			name.includes('sink') ||
			name.includes('save') ||
			name.includes('write') ||
			name.includes('send') ||
			content.includes('write') ||
			content.includes('emit(')
		);
	}

	private hasTransformerIndicators(element: CodeElement): boolean {
		// Look for patterns indicating a data transformer
		const name = (element.name || '').toLowerCase();
		const content = (element.content || '').toLowerCase();

		return (
			name.includes('transform') ||
			name.includes('convert') ||
			name.includes('format') ||
			name.includes('parse') ||
			name.includes('map') ||
			name.includes('process') ||
			(content.includes('return') &&
				(content.includes('map(') ||
					content.includes('filter(') ||
					content.includes('reduce(')))
		);
	}

	private hasStoreIndicators(element: CodeElement): boolean {
		// Look for patterns indicating a data store (cache, state, etc.)
		const name = (element.name || '').toLowerCase();
		const type = (element.type || '').toLowerCase();

		return (
			name.includes('store') ||
			name.includes('state') ||
			name.includes('cache') ||
			name.includes('repository') ||
			name.includes('db') ||
			name.includes('database') ||
			type.includes('store') ||
			type.includes('repository')
		);
	}

	private isDataFlowRelationship(relationship: any): boolean {
		// Determine if a relationship represents a data flow
		const type = (relationship.type || '').toLowerCase();

		return (
			type.includes('calls') ||
			type.includes('imports') ||
			type.includes('assigns') ||
			type.includes('uses') ||
			type.includes('depends') ||
			type.includes('references') ||
			type.includes('extends') ||
			type.includes('implements')
		);
	}

	private determineDataFlowType(relationship: any): DataFlowType {
		// Determine the type of data flow from the relationship
		const type = (relationship.type || '').toLowerCase();

		if (type.includes('assign')) {
			return DataFlowType.ASSIGNMENT;
		} else if (type.includes('parameter')) {
			return DataFlowType.PARAMETER;
		} else if (type.includes('return')) {
			return DataFlowType.RETURN;
		} else if (type.includes('property')) {
			return DataFlowType.PROPERTY_ACCESS;
		} else if (type.includes('call')) {
			return DataFlowType.METHOD_CALL;
		} else if (type.includes('event')) {
			if (type.includes('emit')) {
				return DataFlowType.EVENT_EMISSION;
			} else {
				return DataFlowType.EVENT_HANDLING;
			}
		} else if (type.includes('state')) {
			return DataFlowType.STATE_MUTATION;
		} else if (type.includes('import')) {
			return DataFlowType.IMPORT;
		} else if (type.includes('export')) {
			return DataFlowType.EXPORT;
		}

		// Default to method call as most common flow type
		return DataFlowType.METHOD_CALL;
	}

	private extractTransformations(relationship: any): string[] {
		// Extract any transformations applied in this data flow
		const transformations: string[] = [];

		if (relationship.transformations) {
			return relationship.transformations;
		}

		if (relationship.context) {
			const context = relationship.context.toLowerCase();

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
		}

		return transformations;
	}

	private isAsyncFlow(relationship: any): boolean {
		// Determine if a data flow is asynchronous
		if (relationship.async !== undefined) {
			return relationship.async;
		}

		if (relationship.context) {
			const context = relationship.context.toLowerCase();

			return (
				context.includes('async') ||
				context.includes('promise') ||
				context.includes('then(') ||
				context.includes('callback') ||
				context.includes('await') ||
				context.includes('eventEmitter')
			);
		}

		return false;
	}

	private isConditionalFlow(relationship: any): boolean {
		// Determine if a data flow is conditional
		if (relationship.conditional !== undefined) {
			return relationship.conditional;
		}

		if (relationship.context) {
			const context = relationship.context.toLowerCase();

			return (
				context.includes('if ') ||
				context.includes('else ') ||
				context.includes('switch') ||
				context.includes('case ') ||
				context.includes('try') ||
				context.includes('catch') ||
				context.includes('?') ||
				context.includes('||') ||
				context.includes('&&')
			);
		}

		return false;
	}

	private calculateNodeConfidence(
		element: CodeElement,
		role: DataNodeRole,
	): number {
		// Calculate confidence based on evidence strength
		let confidence = 0.7; // Base confidence

		// Adjust confidence based on evidence
		const roleProperty = `is${
			role.charAt(0).toUpperCase() + role.slice(1)
		}` as keyof CodeElement;
		if (element[roleProperty]) {
			confidence += 0.2; // Direct indicator
		}

		if (this.checkPatternMatches(element, `data_${role.toLowerCase()}`)) {
			confidence += 0.15; // Pattern match
		}

		// Adjust for name indicators
		const name = (element.name || '').toLowerCase();
		if (name.includes(role.toLowerCase())) {
			confidence += 0.1;
		}

		// Cap confidence at 0.95
		return Math.min(0.95, confidence);
	}

	private calculateFlowConfidence(relationship: any): number {
		// Calculate confidence for a data flow based on evidence
		let confidence = 0.65; // Base confidence

		// Direct type indicators increase confidence
		if (relationship.type && this.isDirectFlowType(relationship.type)) {
			confidence += 0.2;
		}

		// Context increases confidence
		if (relationship.context) {
			confidence += 0.1;
		}

		// Cap confidence at 0.95
		return Math.min(0.95, confidence);
	}

	private isDirectFlowType(type: string): boolean {
		// Determine if a relationship type directly indicates a data flow
		type = type.toLowerCase();

		return (
			type.includes('assigns') ||
			type.includes('returns') ||
			type.includes('parameters') ||
			type.includes('emits')
		);
	}

	private calculatePathConfidence(flows: DataFlow[]): number {
		// Calculate confidence for a path based on its flows
		if (flows.length === 0) {
			return 0;
		}

		// Average confidence of flows, with penalty for long paths
		const avgConfidence =
			flows.reduce((sum, flow) => sum + flow.confidence, 0) / flows.length;
		const lengthPenalty = Math.max(0, (flows.length - 2) * 0.03); // Longer paths are less certain

		return Math.max(0.5, Math.min(0.95, avgConfidence - lengthPenalty));
	}

	private findDataNodeByElementId(
		dataFlowGraph: DataFlowGraph,
		elementId: string,
	): DataNode | null {
		// Find a data node by its element ID
		for (const [_, node] of dataFlowGraph.nodes.entries()) {
			if (node.nodeId === elementId) {
				return node;
			}
		}

		return null;
	}

	private getFlowsForPath(
		nodePath: string[],
		dataFlowGraph: DataFlowGraph,
	): DataFlow[] {
		// Get all flows that connect nodes in the path
		const flows: DataFlow[] = [];

		for (let i = 0; i < nodePath.length - 1; i++) {
			const sourceId = nodePath[i];
			const targetId = nodePath[i + 1];

			if (sourceId && targetId) {
				const flow = dataFlowGraph.flows.find(
					f => f.sourceId === sourceId && f.targetId === targetId,
				);
				if (flow) {
					flows.push(flow);
				}
			}
		}

		return flows;
	}

	private generatePathName(
		nodePath: string[],
		dataFlowGraph: DataFlowGraph,
	): string {
		// Generate a descriptive name for a data flow path
		if (nodePath.length < 2) {
			return 'Empty path';
		}

		const sourceId = nodePath[0];
		const targetId = nodePath[nodePath.length - 1];

		if (!sourceId || !targetId) {
			return 'Invalid path';
		}

		const sourceNode = dataFlowGraph.nodes.get(sourceId);
		const targetNode = dataFlowGraph.nodes.get(targetId);

		if (!sourceNode || !targetNode) {
			return 'Unknown path';
		}

		return `${sourceNode.name} to ${targetNode.name}`;
	}

	private generatePathDescription(
		nodePath: string[],
		dataFlowGraph: DataFlowGraph,
	): string {
		// Generate a detailed description of a data flow path
		if (nodePath.length < 2) {
			return 'Empty data flow path';
		}

		const sourceId = nodePath[0];
		const targetId = nodePath[nodePath.length - 1];

		if (!sourceId || !targetId) {
			return 'Invalid data flow path';
		}

		const sourceNode = dataFlowGraph.nodes.get(sourceId);
		const targetNode = dataFlowGraph.nodes.get(targetId);

		if (!sourceNode || !targetNode) {
			return 'Unknown data flow path';
		}

		let description = `Data flows from ${sourceNode.name} (${sourceNode.role}) to ${targetNode.name} (${targetNode.role})`;

		// Add intermediate nodes if present
		if (nodePath.length > 2) {
			description += ` through ${nodePath.length - 2} intermediate steps`;
		}

		// Add transformation info if available
		const flows = this.getFlowsForPath(nodePath, dataFlowGraph);
		const transformations = flows
			.flatMap(flow => flow.transformations)
			.filter(t => t);

		if (transformations.length > 0) {
			description += ` with ${transformations.join(', ')} transformations`;
		}

		return description;
	}

	private async analyzeNamingPatternsForDataRoles(
		dataFlowGraph: DataFlowGraph,
	): Promise<void> {
		// In a real implementation, this would analyze naming patterns
		// to improve data role detection
		console.log(
			`Analyzing naming patterns for ${dataFlowGraph.nodes.size} data nodes`,
		);
	}

	private async discoverImplicitDataFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		options: any,
	): Promise<void> {
		console.log(
			`Discovering implicit data flows with options: ${JSON.stringify(
				options,
			)}`,
		);

		// Following the "Emergent Indexing Principles" of:
		// 1. Zero Assumptions - not hardcoding expectations about code structure
		// 2. Organic Discovery - letting the codebase reveal its own patterns
		// 3. Evidence-Based Understanding - basing insights on direct evidence

		// Step 1: Discover shared state access patterns
		await this.discoverSharedStateFlows(understanding, dataFlowGraph, options);

		// Step 2: Discover parent-child property access flows
		await this.discoverPropertyAccessFlows(
			understanding,
			dataFlowGraph,
			options,
		);

		// Step 3: Discover data flows through common conceptual usage
		await this.discoverConceptualDataFlows(
			understanding,
			dataFlowGraph,
			options,
		);

		// Step 4: Discover data flows through naming patterns
		await this.discoverNamePatternFlows(understanding, dataFlowGraph, options);

		console.log(
			`Discovered ${dataFlowGraph.flows.length} total data flows after implicit analysis`,
		);
	}

	/**
	 * Discover data flows through shared state access
	 * @private
	 */
	private async discoverSharedStateFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		_options: any, // Unused but kept for API consistency
	): Promise<void> {
		// Identify elements that access the same state or variables
		const stateAccessMap = new Map<string, Set<string>>();

		// Build a map of which code elements access which state elements
		for (const relationship of understanding.relationships) {
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
			const stateDataNode = this.getOrCreateDataNodeForCodeElement(
				dataFlowGraph,
				stateId,
				DataNodeRole.STORE,
			);

			if (!stateDataNode) continue;

			// For each accessor, create flows to and from the state
			for (const accessorId of accessors) {
				// Check if this is a read or write access based on code evidence
				const isWriteAccess = this.isLikelyWriteAccess(
					understanding,
					stateId,
					accessorId,
				);

				// Create the appropriate data node role based on access type
				const accessorRole = isWriteAccess
					? DataNodeRole.SINK
					: DataNodeRole.SOURCE;

				// Create data node for the accessor
				const accessorDataNode = this.getOrCreateDataNodeForCodeElement(
					dataFlowGraph,
					accessorId,
					accessorRole,
				);

				if (!accessorDataNode) continue;

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

				dataFlowGraph.flows.push(flow);
			}
		}
	}

	/**
	 * Determine if a relationship likely represents a write access
	 * @private
	 */
	private isLikelyWriteAccess(
		understanding: CodebaseUnderstanding,
		stateId: string,
		accessorId: string,
	): boolean {
		// Look for evidence of write access in relationships
		for (const relationship of understanding.relationships) {
			if (
				relationship.sourceId === accessorId &&
				relationship.targetId === stateId
			) {
				// Look for write indicators in metadata
				if (
					relationship.metadata?.['isWrite'] ||
					relationship.metadata?.['isAssignment'] ||
					relationship.metadata?.['isUpdate'] ||
					relationship.metadata?.['type'] === 'write'
				) {
					return true;
				}

				// Examine context for write indicators
				const context = relationship.metadata?.['context'];
				if (context && typeof context === 'string') {
					const contextLower = context.toLowerCase();
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
		const accessorNode = understanding.codeNodes.get(accessorId);
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
	 * Discover data flows through property access patterns
	 * @private
	 */
	private async discoverPropertyAccessFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		_options: any, // Unused but kept for API consistency
	): Promise<void> {
		// Look for parent-child property access patterns
		for (const [nodeId, node] of understanding.codeNodes.entries()) {
			// Skip nodes without children
			if (!node.children || node.children.length === 0) continue;

			// Check if this is a data structure that holds other data
			// Check if this node holds structured data - use string comparison for compatibility
			// Following emergent principles: adapt to what we find, don't assume fixed types
			const nodeType =
				typeof node.type === 'string'
					? node.type.toLowerCase()
					: String(node.type).toLowerCase();

			const isDataHolder =
				nodeType === 'class' ||
				nodeType === 'interface' ||
				nodeType === 'enum' ||
				nodeType === 'object' ||
				nodeType === 'module';

			if (!isDataHolder) continue;

			// Create a data node for the parent
			const parentDataNode = this.getOrCreateDataNodeForCodeElement(
				dataFlowGraph,
				nodeId,
				DataNodeRole.STORE,
			);

			if (!parentDataNode) continue;

			// For each property, create a flow to/from the parent
			for (const child of node.children) {
				if (
					child.type === CodeNodeType.PROPERTY ||
					child.type === CodeNodeType.METHOD
				) {
					// Determine if this is a getter or setter based on evidence
					const isGetter = this.isLikelyGetter(child);
					const isSetter = this.isLikelySetter(child);

					if (isGetter || isSetter) {
						// Create data node for the property
						const propertyRole = isGetter
							? DataNodeRole.SOURCE
							: DataNodeRole.SINK;
						const propertyDataNode = this.getOrCreateDataNodeForCodeElement(
							dataFlowGraph,
							child.id,
							propertyRole,
						);

						if (!propertyDataNode) continue;

						// Create the appropriate flow
						const flow: DataFlow = {
							id: `flow_${this.generateFlowId()}`,
							type: DataFlowType.PROPERTY_ACCESS,
							sourceId: isGetter ? parentDataNode.id : propertyDataNode.id,
							targetId: isGetter ? propertyDataNode.id : parentDataNode.id,
							transformations: [],
							async: false,
							conditional: false,
							confidence: 0.75,
							metadata: {
								implicit: true,
								propertyAccess: true,
								accessType: isGetter ? 'get' : 'set',
							},
						};

						dataFlowGraph.flows.push(flow);
					}
				}
			}
		}
	}

	/**
	 * Determine if a code node is likely a getter method/property
	 * @private
	 */
	private isLikelyGetter(node: any): boolean {
		// Check explicit metadata
		if (node.metadata?.isGetter || node.metadata?.type === 'getter') {
			return true;
		}

		// Check name patterns
		if (node.name) {
			const nameLower = node.name.toLowerCase();
			if (
				nameLower.startsWith('get') ||
				nameLower.includes('fetch') ||
				nameLower.includes('read') ||
				nameLower.includes('value')
			) {
				return true;
			}
		}

		// Check content for return statements
		if (node.content && typeof node.content === 'string') {
			const contentLower = node.content.toLowerCase();
			if (
				contentLower.includes('return') &&
				!contentLower.includes('=') // No assignments indicates likely getter
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Determine if a code node is likely a setter method/property
	 * @private
	 */
	private isLikelySetter(node: any): boolean {
		// Check explicit metadata
		if (node.metadata?.isSetter || node.metadata?.type === 'setter') {
			return true;
		}

		// Check name patterns
		if (node.name) {
			const nameLower = node.name.toLowerCase();
			if (
				nameLower.startsWith('set') ||
				nameLower.includes('update') ||
				nameLower.includes('write') ||
				nameLower.includes('store')
			) {
				return true;
			}
		}

		// Check content for assignment operations
		if (node.content && typeof node.content === 'string') {
			const contentLower = node.content.toLowerCase();
			if (
				contentLower.includes('=') &&
				contentLower.includes('this.') // Assignment to this indicates setter
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Discover data flows through conceptual similarity
	 * @private
	 */
	private async discoverConceptualDataFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		_options: any, // Unused but kept for API consistency
	): Promise<void> {
		// Use conceptual units to identify implicit data flows between semantically related elements

		// For each semantic unit, create data flows between its components
		for (const unit of understanding.semanticUnits) {
			if (unit.codeNodeIds.length < 2) continue; // Need at least 2 nodes to create flows

			// Create flows between nodes in the same semantic unit
			for (let i = 0; i < unit.codeNodeIds.length; i++) {
				for (let j = i + 1; j < unit.codeNodeIds.length; j++) {
					const nodeId1 = unit.codeNodeIds[i];
					const nodeId2 = unit.codeNodeIds[j];

					// Check if these nodes show evidence of data exchange
					const node1 = understanding.codeNodes.get(nodeId1 || '');
					const node2 = understanding.codeNodes.get(nodeId2 || '');

					if (!node1 || !node2) continue;

					// Skip if no likely data flow between these nodes
					if (!this.mightShareData(node1, node2, understanding)) continue;

					// Determine likely flow direction based on node types and evidence
					const [sourceId, targetId] = this.determineFlowDirection(
						node1,
						node2,
						understanding,
					);

					// Get or create data nodes
					const sourceNode = this.getOrCreateDataNodeForCodeElement(
						dataFlowGraph,
						sourceId,
						this.inferDataNodeRole(
							understanding.codeNodes.get(sourceId),
							'source',
						),
					);

					const targetNode = this.getOrCreateDataNodeForCodeElement(
						dataFlowGraph,
						targetId,
						this.inferDataNodeRole(
							understanding.codeNodes.get(targetId),
							'target',
						),
					);

					if (!sourceNode || !targetNode) continue;

					// Create a conceptual flow with lower confidence
					const flow: DataFlow = {
						id: `flow_${this.generateFlowId()}`,
						type: DataFlowType.METHOD_CALL, // Default type
						sourceId: sourceNode.id,
						targetId: targetNode.id,
						transformations: [],
						async: false,
						conditional: false,
						confidence: 0.6, // Lower confidence for conceptual flows
						metadata: {
							implicit: true,
							conceptual: true,
							semanticUnitId: unit.id,
							semanticUnitName: unit.name,
						},
					};

					dataFlowGraph.flows.push(flow);
				}
			}
		}
	}

	/**
	 * Check if two nodes might share data based on available evidence
	 * @private
	 */
	private mightShareData(
		node1: any,
		node2: any,
		understanding: CodebaseUnderstanding,
	): boolean {
		// Check for naming pattern similarities
		if (node1.name && node2.name) {
			// Look for common data-related terms in both names
			const name1Lower = node1.name.toLowerCase();
			const name2Lower = node2.name.toLowerCase();

			// Extract root terms from each name
			const terms1 = this.extractDataTerms(name1Lower);
			const terms2 = this.extractDataTerms(name2Lower);

			// Check for common terms
			for (const term of terms1) {
				if (terms2.includes(term)) {
					return true;
				}
			}
		}

		// Check for related relationship patterns
		for (const relationship of understanding.relationships) {
			if (
				(relationship.sourceId === node1.id &&
					relationship.targetId === node2.id) ||
				(relationship.sourceId === node2.id &&
					relationship.targetId === node1.id)
			) {
				// Direct relationship exists, suggesting potential data flow
				return true;
			}
		}

		// Check for common references to the same entities
		const referencedBy1 = new Set<string>();
		const referencedBy2 = new Set<string>();

		for (const relationship of understanding.relationships) {
			if (relationship.sourceId === node1.id) {
				referencedBy1.add(relationship.targetId);
			}
			if (relationship.sourceId === node2.id) {
				referencedBy2.add(relationship.targetId);
			}
		}

		// Check for overlap in referenced nodes
		for (const ref of referencedBy1) {
			if (referencedBy2.has(ref)) {
				return true;
			}
		}

		// If no evidence found, assume no data sharing
		return false;
	}

	/**
	 * Extract potential data-related terms from a name
	 * @private
	 */
	private extractDataTerms(name: string): string[] {
		const terms: string[] = [];

		// Common data-related prefixes to remove
		const prefixes = [
			'get',
			'set',
			'update',
			'fetch',
			'save',
			'load',
			'store',
			'retrieve',
		];

		let processedName = name;
		for (const prefix of prefixes) {
			if (processedName.startsWith(prefix)) {
				processedName = processedName.substring(prefix.length);
				break;
			}
		}

		// Split camelCase and snake_case into separate terms
		const splitTerms = processedName
			.replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
			.replace(/_/g, ' ') // Split snake_case
			.toLowerCase()
			.split(' ')
			.filter(t => t.length > 0);

		// Add all terms
		terms.push(...splitTerms);

		// Also add complete name as a term
		terms.push(name);

		return terms;
	}

	/**
	 * Determine the likely flow direction between two nodes
	 * @private
	 */
	private determineFlowDirection(
		node1: any,
		node2: any,
		understanding: CodebaseUnderstanding,
	): [string, string] {
		// Default to node1 -> node2
		let sourceId = node1.id;
		let targetId = node2.id;

		// Check explicit relationships first
		for (const relationship of understanding.relationships) {
			if (
				relationship.sourceId === node1.id &&
				relationship.targetId === node2.id
			) {
				return [node1.id, node2.id];
			}
			if (
				relationship.sourceId === node2.id &&
				relationship.targetId === node1.id
			) {
				return [node2.id, node1.id];
			}
		}

		// Check node types for likely direction
		const types1 = this.categorizeFunctionType(node1);
		const types2 = this.categorizeFunctionType(node2);

		// If one is a clear source and the other a clear target, use that direction
		if (types1.isSource && types2.isTarget) {
			return [node1.id, node2.id];
		}
		if (types1.isTarget && types2.isSource) {
			return [node2.id, node1.id];
		}

		// If both are the same, use other evidence
		if (
			(types1.isSource && types2.isSource) ||
			(types1.isTarget && types2.isTarget)
		) {
			// Consider the order of definition (earlier often feeds to later)
			if (node1.location && node2.location) {
				if (node1.location.start.line < node2.location.start.line) {
					return [node1.id, node2.id];
				} else {
					return [node2.id, node1.id];
				}
			}
		}

		// If no clear direction can be determined, use the default
		return [sourceId, targetId];
	}

	/**
	 * Categorize a node as a likely source or target based on naming and type
	 * @private
	 */
	private categorizeFunctionType(node: any): {
		isSource: boolean;
		isTarget: boolean;
	} {
		const result = {isSource: false, isTarget: false};

		if (!node.name) return result;

		const nameLower = node.name.toLowerCase();

		// Check for source indicators in the name
		if (
			nameLower.startsWith('get') ||
			nameLower.startsWith('fetch') ||
			nameLower.startsWith('load') ||
			nameLower.startsWith('read') ||
			nameLower.includes('source') ||
			nameLower.includes('provider')
		) {
			result.isSource = true;
		}

		// Check for target indicators in the name
		if (
			nameLower.startsWith('set') ||
			nameLower.startsWith('put') ||
			nameLower.startsWith('update') ||
			nameLower.startsWith('save') ||
			nameLower.startsWith('store') ||
			nameLower.startsWith('write') ||
			nameLower.includes('sink') ||
			nameLower.includes('target')
		) {
			result.isTarget = true;
		}

		return result;
	}

	/**
	 * Infer the appropriate DataNodeRole for a code node
	 * @private
	 */
	private inferDataNodeRole(
		node: any,
		position: 'source' | 'target',
	): DataNodeRole {
		if (!node)
			return position === 'source' ? DataNodeRole.SOURCE : DataNodeRole.SINK;

		// Check explicit role indicators
		if (node.metadata?.isDataSource || this.isLikelyDataSource(node)) {
			return DataNodeRole.SOURCE;
		}
		if (node.metadata?.isDataSink || this.isLikelyDataSink(node)) {
			return DataNodeRole.SINK;
		}
		if (
			node.metadata?.isDataTransformer ||
			this.isLikelyDataTransformer(node)
		) {
			return DataNodeRole.TRANSFORMER;
		}
		if (node.metadata?.isDataStore || this.isLikelyDataStore(node)) {
			return DataNodeRole.STORE;
		}

		// Default based on position
		return position === 'source' ? DataNodeRole.SOURCE : DataNodeRole.SINK;
	}

	/**
	 * Discover data flows through naming patterns
	 * @private
	 */
	private async discoverNamePatternFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		_options: any, // Used for compatibility with interface
	): Promise<void> {
		// Group nodes by naming patterns
		const patternGroups = new Map<string, string[]>();

		// Extract data-related terms from all node names
		for (const [nodeId, node] of understanding.codeNodes.entries()) {
			if (!node.name) continue;

			const terms = this.extractDataTerms(node.name.toLowerCase());

			// For each significant term, add this node to its group
			for (const term of terms) {
				if (term.length < 3) continue; // Skip very short terms

				if (!patternGroups.has(term)) {
					patternGroups.set(term, []);
				}
				patternGroups.get(term)?.push(nodeId);
			}
		}

		// Create flows between nodes in the same naming group
		for (const [term, nodeIds] of patternGroups.entries()) {
			if (nodeIds.length < 2) continue; // Need at least 2 nodes to create flows

			// Only consider significant patterns (not too common, not too rare)
			if (nodeIds.length > understanding.codeNodes.size * 0.2) continue; // Too common

			// Find data flow connections between nodes in this group
			for (let i = 0; i < nodeIds.length; i++) {
				for (let j = i + 1; j < nodeIds.length; j++) {
					const node1 = understanding.codeNodes.get(nodeIds[i] || '');
					const node2 = understanding.codeNodes.get(nodeIds[j] || '');

					if (!node1 || !node2) continue;

					// Skip nodes that are too distant in the codebase
					if (!this.areNodesRelated(node1, node2, understanding)) continue;

					// Determine likely flow direction
					const [sourceId, targetId] = this.determineFlowDirection(
						node1,
						node2,
						understanding,
					);

					// Get or create data nodes
					const sourceNode = this.getOrCreateDataNodeForCodeElement(
						dataFlowGraph,
						sourceId,
						this.inferDataNodeRole(
							understanding.codeNodes.get(sourceId),
							'source',
						),
					);

					const targetNode = this.getOrCreateDataNodeForCodeElement(
						dataFlowGraph,
						targetId,
						this.inferDataNodeRole(
							understanding.codeNodes.get(targetId),
							'target',
						),
					);

					if (!sourceNode || !targetNode) continue;

					// Create a naming pattern flow with lower confidence
					const flow: DataFlow = {
						id: `flow_${this.generateFlowId()}`,
						type: DataFlowType.METHOD_CALL, // Default type
						sourceId: sourceNode.id,
						targetId: targetNode.id,
						transformations: [],
						async: false,
						conditional: false,
						confidence: 0.65, // Lower confidence for naming pattern flows
						metadata: {
							implicit: true,
							namingPattern: true,
							term,
							patternType: 'naming_similarity',
						},
					};

					dataFlowGraph.flows.push(flow);
				}
			}
		}
	}

	/**
	 * Check if two nodes are related enough to consider a data flow between them
	 * @private
	 */
	private areNodesRelated(
		node1: any,
		node2: any,
		understanding: CodebaseUnderstanding,
	): boolean {
		// Check if they are in the same file
		if (node1.path === node2.path) {
			return true;
		}

		// Check for direct relationships
		for (const relationship of understanding.relationships) {
			if (
				(relationship.sourceId === node1.id &&
					relationship.targetId === node2.id) ||
				(relationship.sourceId === node2.id &&
					relationship.targetId === node1.id)
			) {
				return true;
			}
		}

		// Check if they are in the same semantic unit
		for (const unit of understanding.semanticUnits) {
			if (
				unit.codeNodeIds.includes(node1.id) &&
				unit.codeNodeIds.includes(node2.id)
			) {
				return true;
			}
		}

		// Check if they are in related files (e.g., same directory)
		if (node1.path && node2.path) {
			const dir1 = node1.path.substring(0, node1.path.lastIndexOf('/'));
			const dir2 = node2.path.substring(0, node2.path.lastIndexOf('/'));
			if (dir1 === dir2) {
				return true;
			}
		}

		return false;
	}

	private async analyzeFunctionCallFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		_options: any, // Unused but kept for API consistency
	): Promise<void> {
		console.log(
			`Analyzing function call flows in ${understanding.codeNodes.size} nodes`,
		);

		// Following the "Emergent Indexing Principles" of:
		// 1. Zero Assumptions - not assuming any specific function parameter patterns
		// 2. Organic Discovery - letting the code reveal its own function interaction patterns
		// 3. Evidence-Based Understanding - assigning confidence based on evidence quality

		// Create maps for faster lookups while avoiding assumptions about structure
		const functionNodes: Map<string, CodeNode> = new Map();
		const parameterNodes: Map<string, Map<string, CodeNode>> = new Map();
		const returnNodes: Map<string, CodeNode> = new Map();

		// Step 1: Organically discover functions, parameters, and return patterns
		for (const [id, node] of understanding.codeNodes.entries()) {
			// Don't assume only FUNCTION/METHOD types can have parameters or returns
			// Instead, look for evidence in any node that might behave like a function
			const mightBeFunction =
				node.type === CodeNodeType.FUNCTION ||
				node.type === CodeNodeType.METHOD ||
				(node.name && this.hasActionableNamePattern(node.name)) ||
				node.metadata['acceptsParameters'] ||
				node.metadata['hasReturnValue'];

			if (mightBeFunction) {
				functionNodes.set(id, node);

				// Create parameter tracking without assuming structure
				parameterNodes.set(id, new Map());

				// Look for parameter and return evidence in children
				if (node.children) {
					for (const child of node.children) {
						// Look for parameter evidence without assuming node type
						const mightBeParameter =
							child.metadata['isParameter'] ||
							// In CodeNodeType enum, PARAMETER doesn't exist
							// so we check for string representation instead
							String(child.type).toLowerCase() === 'parameter' ||
							(child.type === CodeNodeType.VARIABLE &&
								this.isLikelyParameter(child)) ||
							(child.name && this.hasParameterNamePattern(child.name));

						if (mightBeParameter) {
							parameterNodes.get(id)?.set(child.id, child);
						}

						// Look for return evidence without assuming structure
						const mightBeReturn =
							child.metadata['isReturn'] ||
							child.metadata['isReturnValue'] ||
							(child.name && this.hasReturnNamePattern(child.name)) ||
							(child.content && this.containsReturnStatement(child.content));

						if (mightBeReturn) {
							returnNodes.set(id, child);
						}
					}
				}
			}
		}

		// Step 2: Organically discover data flows from function calls
		for (const relationship of understanding.relationships) {
			// Consider all relationship types that might represent function calls
			const mightBeFunctionCall =
				relationship.type === RelationshipType.CALLS ||
				relationship.metadata['isCall'] ||
				relationship.metadata['isInvocation'] ||
				(relationship.metadata['context'] &&
					this.containsFunctionCallIndicators(
						relationship.metadata['context'],
					));

			if (mightBeFunctionCall) {
				const callerNode = understanding.codeNodes.get(relationship.sourceId);
				const calleeNode = understanding.codeNodes.get(relationship.targetId);

				if (!callerNode || !calleeNode) continue;

				// Get parameter and return information if available
				const calleeParams = parameterNodes.get(calleeNode.id);
				const calleeReturn = returnNodes.get(calleeNode.id);

				// Process parameter data flows with evidence-based confidence
				const argumentsData = relationship.metadata['arguments'];

				// Even without explicit argument metadata, look for parameter patterns
				if (calleeParams && calleeParams.size > 0) {
					// With explicit argument data
					if (argumentsData) {
						for (const [paramIdx, paramData] of Object.entries(argumentsData)) {
							// Find the parameter node and the argument source node
							const paramNodeId = Array.from(calleeParams.keys())[
								Number(paramIdx)
							];
							// Safely extract sourceId from paramData using type guards
							const argSourceId = typeof paramData === 'object' && paramData !== null ?
								(paramData as Record<string, unknown>)['sourceId'] as string | undefined :
								undefined;

							if (paramNodeId && argSourceId) {
								this.createParameterFlow(
									dataFlowGraph,
									paramNodeId,
									argSourceId,
									relationship,
									0.85,
								);
							}
						}
					}
					// Without explicit argument data, use other evidence
					else if (relationship.metadata?.['context']) {
						// Look for evidence of parameter passing in the context
						const parameterIds = Array.from(calleeParams.keys());

						// Create flows with lower confidence due to less explicit evidence
						for (const paramId of parameterIds) {
							// Find potential argument sources from context
							const possibleArgSources = this.inferArgumentSources(
								relationship.metadata['context'],
								callerNode,
								understanding,
							);

							for (const argSourceId of possibleArgSources) {
								// Create with lower confidence as it's inferred, not explicit
								this.createParameterFlow(
									dataFlowGraph,
									paramId,
									argSourceId,
									relationship,
									0.7,
								);
							}
						}
					}
				}

				// Process return value flows with evidence-based confidence
				if (calleeReturn) {
					// With explicit result usage
					const resultUsageId =
						relationship.metadata['resultUsage']['targetId'];

					if (resultUsageId) {
						this.createReturnFlow(
							dataFlowGraph,
							calleeReturn.id,
							resultUsageId,
							relationship,
							0.8,
						);
					}
					// Without explicit result usage, use context
					else if (relationship.metadata['context']) {
						// Look for evidence of return value usage in the context
						const possibleResultTargets = this.inferReturnTargets(
							relationship.metadata['context'],
							callerNode,
							understanding,
						);

						for (const targetId of possibleResultTargets) {
							// Create with lower confidence as it's inferred
							this.createReturnFlow(
								dataFlowGraph,
								calleeReturn.id,
								targetId,
								relationship,
								0.7,
							);
						}
					}
					// Create implicit return flow to caller as fallback
					else {
						this.createReturnFlow(
							dataFlowGraph,
							calleeReturn.id,
							relationship.sourceId,
							relationship,
							0.6, // Lower confidence for implicit returns
						);
					}
				}
			}
		}

		// Step 3: Analyze method chains to identify flows between chained calls
		await this.analyzeMethodChains(understanding, dataFlowGraph, _options);

		console.log(
			`Found ${dataFlowGraph.flows.length} function call-related data flows`,
		);
	}

	/**
	 * Analyze method chains to identify data flows between chained method calls
	 * @private
	 */
	private async analyzeMethodChains(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		_options: any,
	): Promise<void> {
		// Identify method chains (a.b().c().d())
		const methodChains: Array<{nodes: string[]; relationships: string[]}> = [];
		const processedRelationships = new Set<string>();

		// Step 1: Find the starting points of method chains
		for (const relationship of understanding.relationships) {
			if (
				relationship.type === RelationshipType.CALLS &&
				!processedRelationships.has(relationship.id)
			) {
				// Look for evidence that this might be part of a method chain
				// Using multiple indicators without assuming any specific pattern
				const isChainEvidence =
					// Check for explicit metadata indicators
					(relationship.metadata &&
						(relationship.metadata['isMethodChain'] ||
							relationship.metadata['chainPosition'] ||
							relationship.metadata['isChained'])) ||
					// Or look for chain patterns in the context if available
					(relationship.metadata &&
						relationship.metadata['context'] &&
						typeof relationship.metadata['context'] === 'string' &&
						(relationship.metadata['context'] as string).includes('.') &&
						(relationship.metadata['context'] as string).includes('('));

				if (isChainEvidence) {
					// Start a new chain
					const chain = {
						nodes: [relationship.sourceId, relationship.targetId],
						relationships: [relationship.id],
					};
					processedRelationships.add(relationship.id);

					// Recursively find next calls in the chain
					this.followMethodChain(understanding, chain, processedRelationships);

					// Only consider chains with at least 2 method calls
					if (chain.relationships.length >= 2) {
						methodChains.push(chain);
					}
				}
			}
		}

		// Step 2: Create data flows between methods in each chain
		// Following our emergent indexing principles, we build understanding from evidence
		for (const chain of methodChains) {
			for (let i = 0; i < chain.nodes.length - 1; i++) {
				const sourceNodeId = chain.nodes[i];
				const targetNodeId = chain.nodes[i + 1];

				// Get the actual nodes from codeNodes map
				const sourceNode = understanding.codeNodes.get(sourceNodeId || '');
				const targetNode = understanding.codeNodes.get(targetNodeId || '');

				if (!sourceNode || !targetNode) continue;

				// Create data flow nodes from the source and target nodes
				const sourceDataNode = this.getOrCreateDataNodeForCodeElement(
					dataFlowGraph,
					sourceNodeId || '',
					DataNodeRole.SOURCE,
				);

				const targetDataNode = this.getOrCreateDataNodeForCodeElement(
					dataFlowGraph,
					targetNodeId || '',
					DataNodeRole.TRANSFORMER,
				);

				if (sourceDataNode && targetDataNode) {
					// Determine if we can infer this is an async flow
					const relationship = understanding.relationships.find(
						r => r.id === chain.relationships[i],
					);

					// Create the data flow
					const flow: DataFlow = {
						id: `flow_${this.generateFlowId()}`,
						type: DataFlowType.METHOD_CALL,
						sourceId: sourceDataNode.id,
						targetId: targetDataNode.id,
						transformations: relationship
							? this.extractTransformations(relationship)
							: [],
						async: relationship ? this.isAsyncFlow(relationship) : false,
						conditional: relationship
							? this.isConditionalFlow(relationship)
							: false,
						confidence: 0.75, // Moderate confidence for method chain inference
						metadata: {
							chainIndex: i,
							isMethodChain: true,
							sourceType: sourceNode.type.toString(),
							targetType: targetNode.type.toString(),
						},
					};

					dataFlowGraph.flows.push(flow);
				}
			}
		}
	}

	/**
	 * Follow a method chain recursively
	 * @private
	 */
	private followMethodChain(
		understanding: CodebaseUnderstanding,
		chain: {nodes: string[]; relationships: string[]},
		processedRelationships: Set<string>,
	): void {
		const lastNodeId = chain.nodes[chain.nodes.length - 1];

		// Look for outgoing call relationships from the last node
		for (const relationship of understanding.relationships) {
			if (
				relationship.type === RelationshipType.CALLS &&
				relationship.sourceId === lastNodeId &&
				!processedRelationships.has(relationship.id)
			) {
				// Look for evidence this is part of the same method chain
				// Using multiple indicators for a more adaptive approach
				const isChainEvidence =
					// Check for explicit metadata indicators
					(relationship.metadata &&
						(relationship.metadata['isMethodChain'] ||
							relationship.metadata['chainPosition'] ||
							relationship.metadata['isChained'])) ||
					// Or look for chain patterns in the context if available
					(relationship.metadata &&
						relationship.metadata['context'] &&
						typeof relationship.metadata['context'] === 'string' &&
						(relationship.metadata['context'] as string).includes('.') &&
						(relationship.metadata['context'] as string).includes('('));

				if (isChainEvidence) {
					// Add to the chain
					chain.nodes.push(relationship.targetId);
					chain.relationships.push(relationship.id);
					processedRelationships.add(relationship.id);

					// Continue following the chain
					this.followMethodChain(understanding, chain, processedRelationships);
					break;
				}
			}
		}
	}

	/**
	 * Get or create a data node for a code element
	 * @private
	 */
	private getOrCreateDataNodeForCodeElement(
		dataFlowGraph: DataFlowGraph,
		codeElementId: string,
		defaultRole: DataNodeRole,
	): DataNode | null {
		// First, check if we already have a data node for this code element
		for (const [_, node] of dataFlowGraph.nodes.entries()) {
			if (node.nodeId === codeElementId) {
				return node;
			}
		}

		// If not found, create a new data node
		// Here we would normally look up the code element in the understanding
		// For simplicity, we'll create a basic node with the default role
		const node: DataNode = {
			id: `node_${this.generateNodeId()}`,
			name: `Node_${codeElementId}`, // Would normally use the actual name
			nodeId: codeElementId,
			role: defaultRole,
			confidence: 0.7,
			metadata: {
				// Minimal metadata since we don't have the actual code element
				type: 'unknown',
			},
		};

		dataFlowGraph.nodes.set(node.id, node);
		return node;
	}

	/**
	 * Creates a parameter flow between arguments and parameters
	 * @private
	 */
	private createParameterFlow(
		dataFlowGraph: DataFlowGraph,
		paramNodeId: string,
		argSourceId: string,
		relationship: any,
		confidence: number,
	): void {
		// Find or create data nodes for parameter and argument
		const paramNode = this.getOrCreateDataNodeForCodeElement(
			dataFlowGraph,
			paramNodeId,
			DataNodeRole.TRANSFORMER,
		);

		const argNode = this.getOrCreateDataNodeForCodeElement(
			dataFlowGraph,
			argSourceId,
			DataNodeRole.SOURCE,
		);

		if (paramNode && argNode) {
			// Create the data flow between argument and parameter
			const flow: DataFlow = {
				id: `flow_${this.generateFlowId()}`,
				type: DataFlowType.PARAMETER,
				sourceId: argNode.id,
				targetId: paramNode.id,
				transformations: this.detectTransformations(relationship),
				async: this.isAsyncFunctionCall(relationship),
				conditional: this.isConditionalFunctionCall(relationship),
				confidence: confidence,
				metadata: {
					relationshipId: relationship.id,
					context: relationship.metadata?.context,
				},
			};

			dataFlowGraph.flows.push(flow);
		}
	}

	/**
	 * Creates a return flow from a function to its caller or result usage
	 * @private
	 */
	private createReturnFlow(
		dataFlowGraph: DataFlowGraph,
		returnNodeId: string,
		targetNodeId: string,
		relationship: any,
		confidence: number,
	): void {
		// Find or create data nodes
		const returnNode = this.getOrCreateDataNodeForCodeElement(
			dataFlowGraph,
			returnNodeId,
			DataNodeRole.SOURCE,
		);

		const targetNode = this.getOrCreateDataNodeForCodeElement(
			dataFlowGraph,
			targetNodeId,
			DataNodeRole.TRANSFORMER,
		);

		if (returnNode && targetNode) {
			// Create the data flow from return to target
			const flow: DataFlow = {
				id: `flow_${this.generateFlowId()}`,
				type: DataFlowType.RETURN,
				sourceId: returnNode.id,
				targetId: targetNode.id,
				transformations: this.detectTransformations(relationship),
				async: this.isAsyncFunctionCall(relationship),
				conditional: this.isConditionalFunctionCall(relationship),
				confidence: confidence,
				metadata: {
					relationshipId: relationship.id,
					context: relationship.metadata?.context,
				},
			};

			dataFlowGraph.flows.push(flow);
		}
	}

	/**
	 * Check if a node is likely a parameter based on evidence
	 * @private
	 */
	private isLikelyParameter(node: any): boolean {
		// Never assume a fixed structure for parameters

		// Check name patterns
		if (node.name) {
			if (this.hasParameterNamePattern(node.name)) {
				return true;
			}
		}

		// Check context/content for parameter indicators
		if (node.content) {
			const contentLower =
				typeof node.content === 'string' ? node.content.toLowerCase() : '';

			if (
				contentLower.includes('param') ||
				contentLower.includes('argument') ||
				contentLower.includes('@param')
			) {
				return true;
			}
		}

		// Check metadata for parameter indicators
		if (node.metadata) {
			if (
				node.metadata.parameterIndex !== undefined ||
				node.metadata.isArgument ||
				node.metadata.parameterPosition !== undefined
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if a name follows parameter naming patterns
	 * @private
	 */
	private hasParameterNamePattern(name: string): boolean {
		const lowerName = name.toLowerCase();
		return (
			lowerName.includes('param') ||
			lowerName.includes('arg') ||
			lowerName.includes('input')
		);
	}

	/**
	 * Checks if a name follows return value naming patterns
	 * @private
	 */
	private hasReturnNamePattern(name: string): boolean {
		const lowerName = name.toLowerCase();
		return (
			lowerName.includes('return') ||
			lowerName.includes('result') ||
			lowerName.includes('output')
		);
	}

	/**
	 * Checks if content contains return statements
	 * @private
	 */
	private containsReturnStatement(content: any): boolean {
		if (typeof content !== 'string') return false;

		const contentLower = content.toLowerCase();
		return (
			contentLower.includes('return ') ||
			contentLower.includes('resolve(') ||
			contentLower.includes('yield ')
		);
	}

	/**
	 * Checks if a node name suggests an actionable function
	 * @private
	 */
	private hasActionableNamePattern(name: string): boolean {
		const lowerName = name.toLowerCase();

		// Action verbs commonly used in function names
		const actionVerbs = [
			'get',
			'set',
			'update',
			'create',
			'delete',
			'add',
			'remove',
			'fetch',
			'load',
			'save',
			'process',
			'transform',
			'calculate',
			'compute',
			'validate',
			'check',
			'verify',
			'handle',
			'convert',
		];

		// Check if name starts with an action verb
		for (const verb of actionVerbs) {
			if (lowerName.startsWith(verb)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if a context string contains function call indicators
	 * @private
	 */
	private containsFunctionCallIndicators(context: any): boolean {
		if (typeof context !== 'string') return false;

		const contextLower = context.toLowerCase();

		// Look for function call patterns
		const callPatterns = [
			/\w+\s*\(\s*.*\s*\)/, // functionName(...)
			/\.\w+\s*\(\s*.*\s*\)/, // object.method(...)
			/\bcall\b/, // "call" keyword
			/\binvoke\b/, // "invoke" keyword
			/\bexecute\b/, // "execute" keyword
		];

		for (const pattern of callPatterns) {
			if (pattern.test(contextLower)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Infer potential argument sources from context
	 * @private
	 */
	private inferArgumentSources(
		context: any,
		callerNode: any,
		understanding: CodebaseUnderstanding,
	): string[] {
		const sources: string[] = [];

		// If no valid context, return empty
		if (typeof context !== 'string') return sources;

		// Look for variable references in the caller's scope
		if (callerNode.children) {
			for (const child of callerNode.children) {
				// Only consider variables and constants as potential arguments
				if (
					child.type === CodeNodeType.VARIABLE ||
					child.type === CodeNodeType.CONSTANT
				) {
					// If the variable name appears in the context, it might be an argument
					if (child.name && context.includes(child.name)) {
						sources.push(child.id);
					}
				}
			}
		}

		// Find nodes referenced by the caller that might be arguments
		for (const relationship of understanding.relationships) {
			if (relationship.sourceId === callerNode.id) {
				const referencedNode = understanding.codeNodes.get(
					relationship.targetId,
				);

				// Skip if node doesn't exist
				if (!referencedNode) continue;

				// If the referenced node's name appears in context, might be argument
				if (referencedNode.name && context.includes(referencedNode.name)) {
					sources.push(referencedNode.id);
				}
			}
		}

		return sources;
	}

	/**
	 * Infer potential return value targets from context
	 * @private
	 */
	private inferReturnTargets(
		context: any,
		callerNode: any,
		understanding: CodebaseUnderstanding,
	): string[] {
		const targets: string[] = [];

		// If no valid context, return empty
		if (typeof context !== 'string') return targets;

		// Look for assignment patterns in the context
		// e.g., "const result = functionCall()" or "x = functionCall()"
		const assignmentMatch = context.match(/(\w+)\s*=\s*[^=]/);
		if (assignmentMatch && assignmentMatch[1]) {
			const varName = assignmentMatch[1];

			// Find variable with this name in caller's scope
			if (callerNode.children) {
				for (const child of callerNode.children) {
					if (child.name === varName) {
						targets.push(child.id);
						break;
					}
				}
			}
		}

		// Look for targets that the caller references after this call
		const callRelationships = [];
		let foundThisCall = false;

		// Organize relationships in sequence
		for (const relationship of understanding.relationships) {
			if (relationship.sourceId === callerNode.id) {
				if (relationship.id === context) {
					foundThisCall = true;
					continue;
				}

				if (foundThisCall) {
					callRelationships.push(relationship);
				}
			}
		}

		// The first few relationships after this call might use the return value
		const maxChecks = Math.min(3, callRelationships.length);
		for (let i = 0; i < maxChecks; i++) {
			const relationship = callRelationships[i];
			if (relationship && relationship.targetId) {
				targets.push(relationship.targetId);
			}
		}

		return targets;
	}

	/**
	 * Detect transformations applied in the function call
	 * @private
	 */
	private detectTransformations(relationship: any): string[] {
		// If relationship already has transformations, use those
		if (relationship.transformations) {
			return relationship.transformations;
		}

		const transformations: string[] = [];

		// Look for transformation evidence in context
		if (relationship.metadata?.context) {
			const context =
				typeof relationship.metadata.context === 'string'
					? relationship.metadata.context.toLowerCase()
					: '';

			// Common transformation patterns
			const patterns = [
				{name: 'map', regex: /\.map\s*\(/},
				{name: 'filter', regex: /\.filter\s*\(/},
				{name: 'reduce', regex: /\.reduce\s*\(/},
				{name: 'transform', regex: /transform|convert/},
				{name: 'format', regex: /format|stringify|parse/},
				{name: 'sort', regex: /\.sort\s*\(|sort|order/},
				{name: 'aggregate', regex: /aggregate|group|combine/},
			];

			// Check for each pattern
			for (const pattern of patterns) {
				if (pattern.regex.test(context)) {
					transformations.push(pattern.name);
				}
			}
		}

		return transformations;
	}

	/**
	 * Check if a function call is asynchronous
	 * @private
	 */
	private isAsyncFunctionCall(relationship: any): boolean {
		return Boolean(
			relationship.metadata?.isAsync ||
				relationship.metadata?.context?.includes('async') ||
				relationship.metadata?.context?.includes('promise') ||
				relationship.metadata?.context?.includes('then('),
		);
	}

	/**
	 * Check if a function call is conditional
	 * @private
	 */
	private isConditionalFunctionCall(relationship: any): boolean {
		return Boolean(
			relationship.metadata?.isConditional ||
				relationship.metadata?.context?.includes('if ') ||
				relationship.metadata?.context?.includes('else ') ||
				relationship.metadata?.context?.includes('switch') ||
				relationship.metadata?.context?.includes('?') ||
				relationship.metadata?.context?.includes('||') ||
				relationship.metadata?.context?.includes('&&'),
		);
	}

	private async discoverAsyncDataFlows(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
		options: any,
	): Promise<void> {
		// In a real implementation, this would discover asynchronous data flows
		// (events, promises, callbacks)
		console.log(
			`Discovering async data flows for ${understanding.id} with ${dataFlowGraph.flows.length} flows and options: ${JSON.stringify(options)}`,
		);
	}

	private async analyzeDataTypePropagation(
		dataFlowGraph: DataFlowGraph,
	): Promise<void> {
		// In a real implementation, this would analyze how data types
		// propagate through the flow graph
		console.log(
			`Analyzing data type propagation for ${dataFlowGraph.flows.length} flows`,
		);
	}

	private async detectDataTransformationPatterns(
		dataFlowGraph: DataFlowGraph,
	): Promise<void> {
		// In a real implementation, this would detect patterns in how data
		// is transformed as it flows
		console.log(
			`Detecting data transformation patterns in ${dataFlowGraph.flows.length} flows`,
		);
	}

	private async identifyCommonDataFlowPatterns(
		understanding: CodebaseUnderstanding,
		dataFlowGraph: DataFlowGraph,
	): Promise<void> {
		// In a real implementation, this would identify common patterns
		// in data flow (e.g., ETL, pub-sub)
		console.log(
			`Identifying common data flow patterns among ${dataFlowGraph.paths.length} paths and ${understanding.patterns.length} discovered patterns`,
		);
	}

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
