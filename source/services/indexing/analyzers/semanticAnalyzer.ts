/**
 * Semantic Analyzer
 *
 * Analyzes the semantic meaning of code elements to extract concepts and semantic units
 * with deeper code understanding and natural language processing techniques.
 *
 * Follows emergent indexing principles by:
 * - Making zero assumptions about programming languages or structures
 * - Discovering concepts organically from code patterns and documentation
 * - Building semantic understanding from observed relationships
 * - Connecting related code elements based on multiple evidence types
 */

import {v4 as uuidv4} from 'uuid';
import {
	EmergentAnalyzer,
	FileNode,
	CodeNode,
	CodeNodeType,
	IndexingPhase,
	Concept,
	SemanticUnit,
	RelationshipType,
} from '../unifiedTypes.js';

import {SharedAnalysisContext} from '../sharedAnalysisContext.js';

/**
 * SemanticAnalyzer discovers conceptual meaning and relationships in code
 * without making assumptions about languages, paradigms, or organization.
 */
export class SemanticAnalyzer implements EmergentAnalyzer {
	// Core analyzer properties
	readonly id: string = 'semantic-analyzer';
	readonly name: string = 'Semantic Analyzer';
	readonly priority: number = 80; // Lower priority (runs after structural analyzers)
	readonly dependencies: string[] = [
		'language-detector',
		'relationship-analyzer',
		'pattern-analyzer',
		'dependency-analyzer',
	];

	// Internal state for concept extraction
	private concepts: Concept[] = [];
	private semanticUnits: SemanticUnit[] = [];
	private wordCounts: Record<
		string,
		{count: number; nodes: string[]; importance: number}
	> = {};
	private commentTerms: Record<
		string,
		{count: number; nodes: string[]; importance: number}
	> = {};
	private dataStructures: Record<
		string,
		{node: CodeNode; properties: string[]; methods: string[]}
	> = {};

	/**
	 * Initialize the semantic analyzer with the shared context
	 */
	async initialize(context: SharedAnalysisContext): Promise<void> {
		// Reset state
		this.concepts = [];
		this.semanticUnits = [];
		this.wordCounts = {};
		this.commentTerms = {};
		this.dataStructures = {};

		context.recordEvent('analyzer-initialized', {analyzer: this.id});
	}

	/**
	 * Analyze each file to gather semantic information
	 */
	async analyzeFile(
		file: FileNode,
		content: string,
		context: SharedAnalysisContext,
	): Promise<void> {
		// Skip files without language type
		if (!file.languageType) {
			return;
		}

		// Process code nodes from this file
		for (const node of context.codeNodes.values()) {
			if (node.path === file.path) {
				// Extract identifier words for concept discovery
				this.extractIdentifierWords(node);

				// Process comments for extracting domain concepts
				this.processComments(node);

				// Process data structures for semantic understanding
				this.processDataStructures(node);
			}
		}
	}

	/**
	 * Process relationships between code elements for semantic analysis
	 */
	async processRelationships(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.RELATIONSHIP_MAPPING) {
			return;
		}

		// Extract initial concepts from multiple dimensions
		this.concepts = [
			// 1. File and module level concepts
			...(await this.extractFileModuleConcepts(context)),

			// 2. Code identifier concepts (from functions, classes, variables, etc.)
			...(await this.extractIdentifierConcepts(context)),

			// 3. Comment and documentation concepts
			...(await this.extractDocumentationConcepts()),

			// 4. Data structure concepts
			...(await this.extractDataStructureConcepts(context)),
		];

		// Record event
		context.recordEvent('semantic-concepts-extracted', {
			analyzer: this.id,
			conceptCount: this.concepts.length,
		});
	}

	/**
	 * Discover semantic patterns in the codebase
	 */
	async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.PATTERN_DISCOVERY) {
			return;
		}

		// Create semantic units by grouping related code elements
		this.semanticUnits = [
			// 1. Concept-based units
			...(await this.createConceptBasedUnits(context)),

			// 2. Pattern-based units
			...(await this.createPatternBasedUnits(context)),

			// 3. Relationship-based units
			...(await this.createRelationshipBasedUnits(context)),

			// 4. Directory-based units
			...(await this.createDirectoryBasedUnits(context)),
		];

		// Enhance the relationships between concepts
		await this.enhanceConceptRelationships(context);

		// Record event
		context.recordEvent('semantic-units-discovered', {
			analyzer: this.id,
			conceptCount: this.concepts.length,
			unitCount: this.semanticUnits.length,
		});
	}

	/**
	 * Final integration of semantic analysis with the codebase understanding
	 */
	async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.INTEGRATION) {
			return;
		}

		// Add concepts and semantic units to the understanding
		context.understanding.concepts = this.concepts;
		context.understanding.semanticUnits = this.semanticUnits;

		// Record metrics
		context.recordMetric('concepts_extracted', this.concepts.length);
		context.recordMetric('semantic_units_created', this.semanticUnits.length);

		// Count concept types
		const conceptTypes: Record<string, number> = {};
		for (const unit of this.semanticUnits) {
			conceptTypes[unit.type] = (conceptTypes[unit.type] || 0) + 1;
		}

		// Record semantic unit types as metrics
		for (const [type, count] of Object.entries(conceptTypes)) {
			context.recordMetric(`semantic_units_${type}`, count);
		}

		// Tag code nodes with their associated concepts
		this.tagNodesWithConcepts(context);

		context.recordEvent('semantic-analysis-integrated', {
			analyzer: this.id,
			conceptCount: this.concepts.length,
			unitCount: this.semanticUnits.length,
		});
	}

	/**
	 * Release resources
	 */
	async cleanup(): Promise<void> {
		// Clear state to release memory
		this.concepts = [];
		this.semanticUnits = [];
		this.wordCounts = {};
		this.commentTerms = {};
		this.dataStructures = {};
	}

	// --------------------------------------------------------------------------
	// PRIVATE METHODS FOR CONCEPT EXTRACTION
	// --------------------------------------------------------------------------

	/**
	 * Extract words from code identifiers for concept discovery
	 */
	private extractIdentifierWords(node: CodeNode): void {
		// Skip nodes without names
		if (!node.name) return;

		// Get the node type as string for consistency
		const nodeType =
			typeof node.type === 'string'
				? node.type.toLowerCase()
				: String(node.type).toLowerCase();

		// Split the name into words based on naming conventions
		const words = this.splitIdentifier(node.name);

		for (const word of words) {
			// Skip very short or common words
			if (word.length <= 2 || this.isCommonWord(word)) continue;

			if (!this.wordCounts[word]) {
				this.wordCounts[word] = {count: 0, nodes: [], importance: 0};
			}

			this.wordCounts[word].count++;
			if (!this.wordCounts[word].nodes.includes(node.id)) {
				this.wordCounts[word].nodes.push(node.id);
			}

			// Files with special names are more important
			if (nodeType === 'module' && this.isSignificantModuleName(node.name)) {
				this.wordCounts[word].importance += 0.5;
			}
		}

		// Recursively process children
		if (node.children) {
			for (const child of node.children) {
				this.extractIdentifierWords(child);
			}
		}
	}

	/**
	 * Process comments in a code node for concept extraction
	 */
	private processComments(node: CodeNode): void {
		// Look for comments in content
		if (node.content) {
			const commentLines = this.extractCommentLines(node.content);
			if (commentLines.length > 0) {
				// Process each comment line
				for (const line of commentLines) {
					const terms = this.extractKeyTermsFromComment(line);
					this.updateCommentTerms(terms, node.id);
				}
			}
		}

		// Look for documentation in metadata
		if (node.metadata && typeof node.metadata === 'object') {
			const docKeys = [
				'documentation',
				'comment',
				'jsdoc',
				'doc',
				'description',
			];

			for (const key of docKeys) {
				const docValue = node.metadata[key];
				if (typeof docValue === 'string' && docValue.length > 0) {
					const terms = this.extractKeyTermsFromComment(docValue);
					this.updateCommentTerms(terms, node.id, 1.2); // Higher importance for explicit documentation
				}
			}
		}

		// Process children for comments
		if (node.children) {
			for (const child of node.children) {
				this.processComments(child);
			}
		}
	}

	/**
	 * Process data structures for semantic understanding
	 */
	private processDataStructures(node: CodeNode): void {
		const nodeType =
			typeof node.type === 'string'
				? node.type.toLowerCase()
				: String(node.type).toLowerCase();

		// Identify data structure nodes (classes, interfaces, etc.)
		if (
			nodeType === 'class' ||
			nodeType === 'interface' ||
			nodeType === 'struct' ||
			nodeType === 'type'
		) {
			// Initialize entry
			this.dataStructures[node.id] = {
				node,
				properties: [],
				methods: [],
			};

			// Find properties and methods
			if (node.children) {
				for (const child of node.children) {
					const childType =
						typeof child.type === 'string'
							? child.type.toLowerCase()
							: String(child.type).toLowerCase();

					if (childType === 'property' || childType === 'field') {
						this.dataStructures[node.id]?.properties.push(child.name || '');
					} else if (childType === 'method' || childType === 'function') {
						this.dataStructures[node.id]?.methods.push(child.name || '');
					}
				}
			}
		}
	}

	/**
	 * Extract concepts from file and module structures
	 */
	private async extractFileModuleConcepts(
		context: SharedAnalysisContext,
	): Promise<Concept[]> {
		const concepts: Concept[] = [];

		// Get total node count for threshold calculation
		const totalNodes = context.codeNodes.size;

		// Find significant words (used more than a threshold)
		const fileSignificanceThreshold = Math.max(
			2,
			Math.ceil(totalNodes * 0.015),
		);

		for (const [word, {count, nodes, importance}] of Object.entries(
			this.wordCounts,
		)) {
			// Check if this word appears in significant modules/files
			if (count >= fileSignificanceThreshold || importance > 0.3) {
				// Calculate adjusted confidence based on count and importance
				const confidence = Math.min(
					0.9,
					0.4 + count / totalNodes + importance * 0.1,
				);

				// This word might represent an important file/module concept
				concepts.push({
					id: uuidv4(),
					name: this.normalizeConceptName(word),
					description: `Concept extracted from ${count} file and module names`,
					codeElements: nodes,
					confidence: confidence,
					importance: count / totalNodes + importance,
					relatedConcepts: [],
				});
			}
		}

		return concepts;
	}

	/**
	 * Extract concepts from code identifiers (functions, classes, etc.)
	 */
	private async extractIdentifierConcepts(
		context: SharedAnalysisContext,
	): Promise<Concept[]> {
		const concepts: Concept[] = [];

		// Get total node count for threshold calculation
		const totalNodes = context.codeNodes.size;

		// Group words by the node types they appear in
		const wordTypeMap: Record<string, Set<string>> = {};

		for (const [word, {nodes}] of Object.entries(this.wordCounts)) {
			wordTypeMap[word] = new Set();

			for (const nodeId of nodes) {
				const node = context.codeNodes.get(nodeId);
				if (node) {
					const nodeType =
						typeof node.type === 'string'
							? node.type.toLowerCase()
							: String(node.type).toLowerCase();
					wordTypeMap[word].add(nodeType);
				}
			}
		}

		// Find significant identifier concepts based on multiple criteria
		for (const [word, {count, nodes}] of Object.entries(this.wordCounts)) {
			// Calculate a significance score based on multiple factors
			const frequency = count / totalNodes;
			const typeVariety = wordTypeMap[word]?.size || 0;
			const typeVarietyNormalized = typeVariety / 4; // Normalize by typical max number of types
			const significance = frequency + typeVarietyNormalized * 0.2;

			// Check if this is significant enough to be a concept
			// Lower threshold to extract more concepts from identifiers
			if (count >= 2 || significance > 0.03) {
				// Calculate adjusted confidence based on evidence strength
				const confidence = Math.min(
					0.9,
					0.5 + frequency * 5 + typeVarietyNormalized * 0.2,
				);
				const importance = Math.min(
					0.9,
					frequency * 10 + typeVarietyNormalized * 0.2,
				);

				// Create a meaningful description based on where this concept appears
				const typeDescription = Array.from(wordTypeMap[word] || []).join(', ');

				concepts.push({
					id: uuidv4(),
					name: this.normalizeConceptName(word),
					description: `Concept extracted from ${count} ${typeDescription} identifiers`,
					codeElements: nodes,
					confidence: confidence,
					importance: importance,
					relatedConcepts: [],
				});
			}
		}

		return concepts;
	}

	/**
	 * Extract concepts from comments and documentation
	 */
	private async extractDocumentationConcepts(): Promise<Concept[]> {
		const concepts: Concept[] = [];

		// Convert comment terms to concepts
		for (const [term, {count, nodes, importance}] of Object.entries(
			this.commentTerms,
		)) {
			// Accept single instances if they have high importance (from documentation)
			if (count < 2 && importance < 1.0) continue;

			// Calculate confidence and importance
			const confidence = Math.min(0.85, 0.4 + count * 0.05 + importance * 0.1);
			const termImportance = Math.min(
				0.8,
				0.3 + count * 0.02 + importance * 0.1,
			);

			concepts.push({
				id: uuidv4(),
				name: this.normalizeConceptName(term),
				description: `Concept extracted from ${count} documentation comments`,
				codeElements: nodes,
				confidence: confidence,
				importance: termImportance,
				relatedConcepts: [],
			});
		}

		return concepts;
	}

	/**
	 * Extract concepts from data structures (classes, interfaces, etc.)
	 */
	private async extractDataStructureConcepts(
		context: SharedAnalysisContext,
	): Promise<Concept[]> {
		const concepts: Concept[] = [];

		// Create concepts from data structures
		for (const {node, properties, methods} of Object.values(
			this.dataStructures,
		)) {
			if (!node.name) continue;

			// Calculate a confidence score based on completeness
			const hasProperties = properties.length > 0;
			const hasMethods = methods.length > 0;
			const completeness =
				(hasProperties ? 0.4 : 0) + (hasMethods ? 0.4 : 0) + 0.2;

			// Generate a description
			let description = `Data structure representing ${this.splitIdentifier(
				node.name,
			).join(' ')}`;
			if (hasProperties) {
				description += ` with ${properties.length} properties`;
			}
			if (hasMethods) {
				description += `${hasProperties ? ' and' : ' with'} ${
					methods.length
				} methods`;
			}

			// Create the concept
			concepts.push({
				id: uuidv4(),
				name: node.name,
				description,
				codeElements: [node.id],
				confidence: Math.min(0.9, 0.5 + completeness * 0.4),
				importance: Math.min(0.9, 0.4 + completeness * 0.5),
				relatedConcepts: [],
			});
		}

		return concepts;
	}

	// --------------------------------------------------------------------------
	// PRIVATE METHODS FOR SEMANTIC UNIT CREATION
	// --------------------------------------------------------------------------

	/**
	 * Create semantic units based on concept groupings
	 */
	private async createConceptBasedUnits(
		context: SharedAnalysisContext,
	): Promise<SemanticUnit[]> {
		const units: SemanticUnit[] = [];

		// Find high-coherence concept groupings
		for (const concept of this.concepts) {
			// Skip concepts with too few elements
			if (concept.codeElements.length < 3) continue;

			// Check if elements form a coherent semantic unit
			const coherenceScore = this.calculateConceptCoherence(concept, context);

			// Lower coherence threshold to create more semantic units
			if (coherenceScore > 0.4) {
				// Create a semantic unit
				units.push({
					id: uuidv4(),
					type: this.determineSemanticUnitType(concept, context),
					name: `${concept.name} ${this.determineSemanticUnitType(
						concept,
						context,
					)}`,
					description: `A semantic unit based on the ${concept.name} concept`,
					codeNodeIds: concept.codeElements,
					confidence: Math.min(0.95, concept.confidence + coherenceScore * 0.2),
					concepts: [concept.id],
					semanticProperties: {
						cohesion: coherenceScore,
						size: concept.codeElements.length,
						dominantConcept: concept.name,
					},
				});
			}
		}

		return units;
	}

	/**
	 * Create semantic units based on discovered code patterns
	 */
	private async createPatternBasedUnits(
		context: SharedAnalysisContext,
	): Promise<SemanticUnit[]> {
		const units: SemanticUnit[] = [];

		// Use discovered patterns to form semantic units
		for (const pattern of context.patterns) {
			// Skip patterns that are too common or too rare
			if (pattern.confidence < 0.6 || pattern.instances.length < 3) continue;

			// Extract node IDs from pattern instances
			const nodeIds = pattern.instances.map(instance => instance.nodeId);

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
					cohesion: 0.65, // Moderate default cohesion for pattern-based units
				},
			});
		}

		return units;
	}

	/**
	 * Create semantic units based on relationship density
	 */
	private async createRelationshipBasedUnits(
		context: SharedAnalysisContext,
	): Promise<SemanticUnit[]> {
		const units: SemanticUnit[] = [];

		// Build a relationship graph
		const nodeRelationships: Record<string, Set<string>> = {};

		// Initialize relationship sets
		for (const node of context.codeNodes.values()) {
			nodeRelationships[node.id] = new Set();
		}

		// Populate relationships
		for (const relationship of context.relationships) {
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
				0.7, // Minimum relationship density
			);

			// Only create units for sufficiently large clusters
			if (cluster.size >= 4) {
				// Get the node names for a meaningful unit name
				const nodeNames = Array.from(cluster)
					.map(id => {
						const node = context.codeNodes.get(id);
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
						coupling: 'high',
					},
				});
			}
		}

		return units;
	}

	/**
	 * Create semantic units based on directory structure with cohesion checks
	 */
	private async createDirectoryBasedUnits(
		context: SharedAnalysisContext,
	): Promise<SemanticUnit[]> {
		const units: SemanticUnit[] = [];

		// Group nodes by directory
		const dirToNodesMap: Record<string, string[]> = {};

		for (const node of context.codeNodes.values()) {
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
			const {coherence, dominantConcepts} =
				await this.evaluateDirectoryCoherence(nodeIds, context);

			// Lower threshold for directory-based semantic units
			if (coherence > 0.4) {
				const dirName = this.getDirectoryName(dirPath);

				units.push({
					id: uuidv4(),
					type: 'module',
					name: `${dirName} Module`,
					description: `A semantic unit based on the ${dirName} directory`,
					codeNodeIds: nodeIds,
					confidence: Math.min(0.9, 0.6 + coherence * 0.3),
					concepts: dominantConcepts,
					semanticProperties: {
						dirPath,
						cohesion: coherence,
						size: nodeIds.length,
					},
				});
			}
		}

		return units;
	}

	/**
	 * Enhance concept relationships based on various indicators
	 */
	private async enhanceConceptRelationships(
		context: SharedAnalysisContext,
	): Promise<void> {
		// 1. Build co-occurrence relationships (concepts that appear in the same elements)
		this.buildCoOccurrenceRelationships();

		// 2. Build relationships based on semantic similarity
		this.buildSemanticSimilarityRelationships();

		// 3. Build relationships based on structural code relationships
		this.buildStructuralRelationships(context);

		// 4. Build relationships based on data flow connections
		if (context.understanding.dataFlow) {
			this.buildDataFlowRelationships(context);
		}
	}

	/**
	 * Build concept relationships based on code element co-occurrence
	 */
	private buildCoOccurrenceRelationships(): void {
		// Find co-occurrence relationships between concepts
		for (let i = 0; i < this.concepts.length; i++) {
			const concept1 = this.concepts[i];

			for (let j = i + 1; j < this.concepts.length; j++) {
				const concept2 = this.concepts[j];

				// Count how many nodes they share
				let sharedNodeCount = 0;
				for (const nodeId of concept1.codeElements) {
					if (concept2.codeElements.includes(nodeId)) {
						sharedNodeCount++;
					}
				}

				// Calculate the Jaccard similarity
				const union = new Set([
					...concept1.codeElements,
					...concept2.codeElements,
				]).size;
				const similarity = sharedNodeCount / union;

				// Lower co-occurrence similarity threshold for more sensitive relationship detection
				if (similarity > 0.15) {
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
	 */
	private buildSemanticSimilarityRelationships(): void {
		for (let i = 0; i < this.concepts.length; i++) {
			const concept1 = this.concepts[i];

			for (let j = i + 1; j < this.concepts.length; j++) {
				const concept2 = this.concepts[j];

				// Calculate name similarity
				const nameSimilarity = this.calculateTextSimilarity(
					concept1.name.toLowerCase(),
					concept2.name.toLowerCase(),
				);

				// Calculate description similarity
				const descSimilarity = this.calculateTextSimilarity(
					concept1.description.toLowerCase(),
					concept2.description.toLowerCase(),
				);

				// Combined similarity score
				const combinedSimilarity = nameSimilarity * 0.7 + descSimilarity * 0.3;

				// Lower semantic similarity threshold to discover more conceptual relationships
				if (combinedSimilarity > 0.45) {
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
	 */
	private buildStructuralRelationships(context: SharedAnalysisContext): void {
		// Build a map from nodes to concepts
		const nodeToConceptsMap: Record<string, string[]> = {};

		for (const concept of this.concepts) {
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
		for (const relationship of context.relationships) {
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
			// Accept weaker structural relationships to discover more connections
			if (strength < 1) continue;

			const [conceptId1, conceptId2] = key.split('-');

			// Find the concepts by id
			const concept1 = this.concepts.find(c => c.id === conceptId1);
			const concept2 = this.concepts.find(c => c.id === conceptId2);

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
	 */
	private buildDataFlowRelationships(context: SharedAnalysisContext): void {
		// Only proceed if we have data flow information
		if (!context.understanding.dataFlow) return;

		// Build a map from nodes to concepts
		const nodeToConceptsMap: Record<string, string[]> = {};

		for (const concept of this.concepts) {
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
		for (const [id, node] of context.understanding.dataFlow.nodes.entries()) {
			if (!node.nodeId) continue;

			if (node.nodeId) {
				if (!codeToDataNodeMap[node.nodeId]) {
					codeToDataNodeMap[node.nodeId] = [];
				}

				codeToDataNodeMap[node.nodeId].push(id);
			}
		}

		// Map of concept pairs to flow strengths
		const flowStrengths: Record<string, number> = {};

		// Analyze data flows to infer concept relationships
		for (const flow of context.understanding.dataFlow.flows) {
			// Find source data node
			const sourceNode = context.understanding.dataFlow.nodes.get(
				flow.sourceId,
			);

			// Find target data node
			const targetNode = context.understanding.dataFlow.nodes.get(
				flow.targetId,
			);

			if (
				!sourceNode ||
				!targetNode ||
				!sourceNode.nodeId ||
				!targetNode.nodeId
			)
				continue;

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
			// Lower threshold for data flow relationships to capture more connections
			if (strength < 1) continue;

			const [sourceConceptId, targetConceptId] = key.split('->');

			// Find the concepts by id
			const sourceConcept = this.concepts.find(c => c.id === sourceConceptId);
			const targetConcept = this.concepts.find(c => c.id === targetConceptId);

			if (sourceConcept && targetConcept && targetConceptId) {
				// Add directional relationship - data flows tend to be directional
				if (!sourceConcept.relatedConcepts.includes(targetConceptId)) {
					sourceConcept.relatedConcepts.push(targetConceptId);
				}
			}
		}
	}

	/**
	 * Tag code nodes with their associated concepts
	 */
	private tagNodesWithConcepts(context: SharedAnalysisContext): void {
		// Create a map from node IDs to concepts
		const nodeToConceptsMap: Record<
			string,
			{conceptIds: string[]; conceptNames: string[]}
		> = {};

		// Populate the map
		for (const concept of this.concepts) {
			for (const nodeId of concept.codeElements) {
				if (!nodeToConceptsMap[nodeId]) {
					nodeToConceptsMap[nodeId] = {conceptIds: [], conceptNames: []};
				}

				nodeToConceptsMap[nodeId].conceptIds.push(concept.id);
				nodeToConceptsMap[nodeId].conceptNames.push(concept.name);
			}
		}

		// Add concept information to code nodes
		for (const [nodeId, {conceptIds, conceptNames}] of Object.entries(
			nodeToConceptsMap,
		)) {
			const node = context.codeNodes.get(nodeId);
			if (node) {
				node.metadata = node.metadata || {};
				node.metadata['concepts'] = conceptIds;
				node.metadata['conceptNames'] = conceptNames;
			}
		}
	}

	// --------------------------------------------------------------------------
	// HELPER METHODS
	// --------------------------------------------------------------------------

	/**
	 * Split an identifier into words based on common naming conventions
	 */
	private splitIdentifier(identifier: string): string[] {
		if (!identifier) return [];

		const result: string[] = [];

		// First, check if the identifier is a short abbreviation that should be kept whole
		if (
			identifier.length <= 3 &&
			this.isTechnicalAbbreviation(identifier.toLowerCase())
		) {
			return [identifier.toLowerCase()];
		}

		// Check for capitalized abbreviations (e.g., "XMLParser" should be split as ["XML", "Parser"])
		let currentIdentifier = identifier;
		const abbreviationMatches = identifier.match(/[A-Z]{2,}/g);
		if (abbreviationMatches) {
			for (const abbr of abbreviationMatches) {
				// Don't break up the abbreviation if it's at the start or end of the identifier
				const isAtStart = identifier.startsWith(abbr);
				const isAtEnd = identifier.endsWith(abbr);

				if (!isAtStart && !isAtEnd) {
					// Replace the abbreviation with a placeholder to prevent further splitting
					currentIdentifier = currentIdentifier.replace(
						abbr,
						`_${abbr.toLowerCase()}_`,
					);
				}
			}
		}

		// Handle different naming conventions
		let words: string[] = [];

		// camelCase or PascalCase
		if (
			/^[a-zA-Z][a-zA-Z0-9]*$/.test(currentIdentifier) &&
			/[A-Z]/.test(currentIdentifier)
		) {
			words = currentIdentifier
				.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
				.toLowerCase()
				.split(/\s+/);
		}
		// snake_case
		else if (currentIdentifier.includes('_')) {
			words = currentIdentifier.toLowerCase().split('_').filter(Boolean);
		}
		// kebab-case
		else if (currentIdentifier.includes('-')) {
			words = currentIdentifier.toLowerCase().split('-').filter(Boolean);
		}
		// handle dot notation (e.g., file extensions)
		else if (currentIdentifier.includes('.')) {
			words = currentIdentifier.toLowerCase().split('.').filter(Boolean);
		}
		// Unknown format, just return the identifier as is
		else {
			words = [currentIdentifier.toLowerCase()];
		}

		// Process each word
		for (const word of words) {
			// Keep short words if they are technical abbreviations
			if (word.length <= 3 && this.isTechnicalAbbreviation(word)) {
				result.push(word);
			}
			// For compound words (that might have numbers), try to break them further
			else if (/[a-z][0-9]|[0-9][a-z]/i.test(word)) {
				const subWords = word.split(/(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])/i);
				result.push(...subWords);
			}
			// Otherwise just add the word
			else {
				result.push(word);
			}
		}

		return result;
	}

	/**
	 * Check if a word is a common programming word to filter out
	 */
	private isCommonWord(word: string): boolean {
		const commonWords = [
			// Programming-specific common words
			'get',
			'set',
			'add',
			'remove',
			'create',
			'delete',
			'update',
			'fetch',
			'init',
			'start',
			'stop',
			'handle',
			'process',
			'execute',
			'run',
			'parse',
			'load',
			'save',
			'build',
			'make',
			'test',
			'check',
			'validate',
			'verify',
			'format',
			'convert',
			'transform',
			'calculate',
			'compute',
			'count',
			'index',
			'key',
			'value',
			'item',
			'element',
			'node',
			'component',
			'module',
			'util',
			'utility',
			'helper',
			'service',
			'factory',
			'provider',
			'manager',
			'controller',
			'model',
			'view',
			'template',
			'function',
			'method',
			'callback',
			'event',
			'listener',
			'handler',
			'config',
			'setup',
			'init',
			'main',
			'app',
			'default',
			'container',
			'wrapper',
			'provider',
			'context',
			'store',
			'state',
			'props',
			'param',
			'arg',
			'input',
			'output',
			'result',
			'response',
			'request',
			'data',
			'info',
			'error',
			'warning',
			'log',
			'debug',
			'temp',
			'tmp',
			'flag',
			'enabled',
			'disabled',
			'active',
			'visible',
			'hidden',
			'selected',
			'current',
			'next',
			'prev',
			'first',
			'last',
			'new',
			'old',
			'min',
			'max',
			'sum',
			'avg',
			'count',
			'file',
			'dir',
			'folder',
			'path',
			'name',
			'id',
			'src',
			'source',
		];

		// Check if the word is in the common words list
		const lowerWord = word.toLowerCase();

		// Skip checking common words if the word is a recognized abbreviation
		if (this.isTechnicalAbbreviation(lowerWord)) {
			return false;
		}

		return commonWords.includes(lowerWord);
	}

	/**
	 * Check if a word is a recognized technical abbreviation
	 */
	private isTechnicalAbbreviation(word: string): boolean {
		// List of common technical abbreviations to keep
		const technicalAbbreviations = [
			// Tech stack abbreviations
			'ai',
			'ml',
			'nlp',
			'api',
			'gui',
			'ui',
			'ux',
			'sdk',
			'cli',
			'css',
			'dom',
			'ssl',
			'tls',
			'jwt',
			'io',
			'db',
			'orm',
			'sql',
			'fk',
			'pk',
			'cdn',
			'dns',
			'ip',
			'tcp',
			'udp',
			'http',
			'url',
			'uri',
			'rest',
			'spa',
			'pwa',
			'ssr',
			'csr',
			'ci',
			'cd',
			'vm',
			'os',
			'fs',
			'cpu',
			'ram',
			'ssd',
			'hdd',
			'api',

			// Development abbreviations
			'dev',
			'prod',
			'qa',
			'uat',
			'src',
			'lib',
			'doc',
			'docs',
			'env',
			'var',

			// Design pattern abbreviations
			'mvc',
			'mvp',
			'mvvm',
			'di',
			'ioc',
			'dao',
			'dto',
			'vo',
			'ddd',
			'tdd',
			'bdd',

			// AI/ML abbreviations
			'nn',
			'cnn',
			'rnn',
			'lstm',
			'gru',
			'gan',
			'nlp',
			'ocr',
			'tts',
			'stt',
			'lm',

			// Project-specific abbreviations
			'llm',
			'rag',
			'gu',
			'ug',
			'uf',
			'au',
			'ur',
		];

		return technicalAbbreviations.includes(word.toLowerCase());
	}

	/**
	 * Check if a module name has special significance
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
			'shared',
		];

		return significantNames.includes(name.toLowerCase());
	}

	/**
	 * Normalize a concept name
	 */
	private normalizeConceptName(word: string): string {
		if (!word) return '';

		// Capitalize the first letter
		return word.charAt(0).toUpperCase() + word.slice(1);
	}

	/**
	 * Extract comment lines from code content
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
					.replace(
						/^\/\/\s*|^#\s*|^--\s*|\*\s*|^\/\*\s*|\*\/\s*|^"""\s*|^'''\s*/g,
						'',
					)
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
			'the',
			'and',
			'a',
			'an',
			'in',
			'on',
			'at',
			'to',
			'for',
			'with',
			'by',
			'of',
			'this',
			'that',
			'it',
			'from',
			'as',
			'be',
			'is',
			'are',
			'was',
			'were',
			'been',
			'being',
			'have',
			'has',
			'had',
			'do',
			'does',
			'did',
			'but',
			'or',
			'if',
			'while',
			'when',
		];

		const filteredWords = words.filter(
			w => !stopwords.includes(w) && !this.isCommonWord(w),
		);

		// Extract terms
		const terms: string[] = [...filteredWords];

		// Common programming domain terms to prioritize (e.g., "database connection")
		const domainTermPatterns = [
			/data\s+(?:flow|structure|model|source|sink|store)/i,
			/(?:code|file|directory)\s+structure/i,
			/(?:semantic|concept|pattern)\s+(?:analysis|extraction|discovery)/i,
			/(?:user|input|data)\s+validation/i,
			/(?:error|exception)\s+handling/i,
			/(?:async|synchronous)\s+(?:processing|operation|function)/i,
			/state\s+management/i,
			/(?:api|service)\s+(?:call|request|response)/i,
			/dependency\s+injection/i,
			/event\s+(?:handler|listener|emitter)/i,
			/(?:database|storage)\s+(?:connection|query|operation)/i,
		];

		// Extract domain-specific multi-word terms
		const commentText = filteredWords.join(' ');
		for (const pattern of domainTermPatterns) {
			const match = commentText.match(pattern);
			if (match && match[0]) {
				terms.push(match[0]);
			}
		}

		// Extract multi-word terms
		// 1. Bi-grams (two word combinations)
		for (let i = 0; i < filteredWords.length - 1; i++) {
			const phrase = `${filteredWords[i]} ${filteredWords[i + 1]}`;
			terms.push(phrase);
		}

		// 2. Tri-grams (three word combinations) for more specific concepts
		for (let i = 0; i < filteredWords.length - 2; i++) {
			const phrase = `${filteredWords[i]} ${filteredWords[i + 1]} ${
				filteredWords[i + 2]
			}`;
			terms.push(phrase);
		}

		// 3. Look for capitalized phrases which often indicate important concepts
		const capitalizedPhraseMatches = comment.match(
			/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g,
		);
		if (capitalizedPhraseMatches) {
			terms.push(
				...capitalizedPhraseMatches.map(phrase => phrase.toLowerCase()),
			);
		}

		return terms;
	}

	/**
	 * Update comment terms with new terms from a node
	 */
	private updateCommentTerms(
		terms: string[],
		nodeId: string,
		importanceMultiplier: number = 1,
	): void {
		for (const term of terms) {
			if (!this.commentTerms[term]) {
				this.commentTerms[term] = {count: 0, nodes: [], importance: 0};
			}

			this.commentTerms[term].count++;
			if (!this.commentTerms[term].nodes.includes(nodeId)) {
				this.commentTerms[term].nodes.push(nodeId);
			}
			this.commentTerms[term].importance += importanceMultiplier;
		}
	}

	/**
	 * Calculate the coherence of a concept
	 */
	private calculateConceptCoherence(
		concept: Concept,
		context: SharedAnalysisContext,
	): number {
		// If the concept has very few elements, coherence is low
		if (concept.codeElements.length < 3) return 0.3;

		// Check if the elements are in the same or related directories
		const dirPaths = new Set<string>();

		for (const nodeId of concept.codeElements) {
			const node = context.codeNodes.get(nodeId);
			if (node && node.path) {
				dirPaths.add(this.getDirectoryPath(node.path));
			}
		}

		// If elements are spread across too many directories, coherence is lower
		const dirRatio =
			1 - Math.min(0.8, dirPaths.size / concept.codeElements.length);

		// Check relationships between elements
		let relatedElementPairs = 0;
		const totalPossiblePairs =
			(concept.codeElements.length * (concept.codeElements.length - 1)) / 2;

		for (const relationship of context.relationships) {
			const sourceIdInConcept = concept.codeElements.includes(
				relationship.sourceId,
			);
			const targetIdInConcept = concept.codeElements.includes(
				relationship.targetId,
			);

			if (sourceIdInConcept && targetIdInConcept) {
				relatedElementPairs++;
			}
		}

		const relationshipRatio =
			totalPossiblePairs > 0 ? relatedElementPairs / totalPossiblePairs : 0;

		// Check name similarity between elements
		const nameCoherence = this.calculateNameCoherence(
			concept.codeElements,
			context,
		);

		// Weighted coherence score
		return dirRatio * 0.4 + relationshipRatio * 0.3 + nameCoherence * 0.3;
	}

	/**
	 * Calculate coherence based on element names
	 */
	private calculateNameCoherence(
		nodeIds: string[],
		context: SharedAnalysisContext,
	): number {
		// Get all node names
		const nodeNames: string[] = [];

		for (const nodeId of nodeIds) {
			const node = context.codeNodes.get(nodeId);
			if (node && node.name) {
				nodeNames.push(node.name.toLowerCase());
			}
		}

		if (nodeNames.length < 2) return 0.5; // Default for too few nodes

		// Split names into word sets
		const wordSets: Set<string>[] = nodeNames.map(
			name => new Set(this.splitIdentifier(name)),
		);

		// Calculate average Jaccard similarity between word sets
		let totalSimilarity = 0;
		let pairCount = 0;

		for (let i = 0; i < wordSets.length; i++) {
			for (let j = i + 1; j < wordSets.length; j++) {
				totalSimilarity += this.calculateJaccardSimilarity(
					wordSets[i],
					wordSets[j],
				);
				pairCount++;
			}
		}

		return pairCount > 0 ? totalSimilarity / pairCount : 0.5;
	}

	/**
	 * Calculate Jaccard similarity between two sets
	 */
	private calculateJaccardSimilarity(
		set1: Set<string>,
		set2: Set<string>,
	): number {
		const intersection = new Set([...set1].filter(item => set2.has(item)));
		const union = new Set([...set1, ...set2]);

		return union.size > 0 ? intersection.size / union.size : 0;
	}

	/**
	 * Determine the most appropriate semantic unit type for a concept
	 */
	private determineSemanticUnitType(
		concept: Concept,
		context: SharedAnalysisContext,
	): string {
		// Type counting for elements in this concept
		const typeCounts: Record<string, number> = {};
		let totalElements = 0;

		for (const nodeId of concept.codeElements) {
			const node = context.codeNodes.get(nodeId);
			if (node) {
				const nodeType =
					typeof node.type === 'string'
						? node.type.toLowerCase()
						: String(node.type).toLowerCase();

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
			module: 'module',
			class: 'class',
			interface: 'interface',
			function: 'function',
			method: 'service',
			variable: 'datastore',
			property: 'schema',
			enum: 'enum',
			namespace: 'namespace',
		};

		return typeMap[dominantType] || 'component';
	}

	/**
	 * Expand a relationship cluster from a starting node
	 */
	private async expandRelationshipCluster(
		startNodeId: string,
		relationships: Record<string, Set<string>>,
		visitedNodes: Set<string>,
		minDensity: number,
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
					relationships,
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
	 */
	private calculateClusterDensity(
		cluster: Set<string>,
		candidateNodeId: string,
		relationships: Record<string, Set<string>>,
	): number {
		// Create a new set with the candidate node
		const expandedCluster = new Set([...cluster, candidateNodeId]);

		// Calculate the number of existing relationships within the expanded cluster
		let relationshipCount = 0;
		const totalPossibleRelationships =
			(expandedCluster.size * (expandedCluster.size - 1)) / 2;

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

		return totalPossibleRelationships > 0
			? relationshipCount / totalPossibleRelationships
			: 0;
	}

	/**
	 * Get the directory path from a file path
	 */
	private getDirectoryPath(filePath: string): string {
		const lastSlashIndex = filePath.lastIndexOf('/');
		return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
	}

	/**
	 * Get the directory name from a directory path
	 */
	private getDirectoryName(dirPath: string): string {
		const lastSlashIndex = dirPath.lastIndexOf('/');
		return lastSlashIndex !== -1
			? dirPath.substring(lastSlashIndex + 1)
			: dirPath;
	}

	/**
	 * Evaluate the coherence of a directory based on its nodes
	 */
	private async evaluateDirectoryCoherence(
		nodeIds: string[],
		context: SharedAnalysisContext,
	): Promise<{coherence: number; dominantConcepts: string[]}> {
		// Count concepts for these nodes
		const conceptCounts: Record<string, number> = {};

		for (const concept of this.concepts) {
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
		const sortedConcepts = Object.entries(conceptCounts).sort(
			([, count1], [, count2]) => count2 - count1,
		);

		// Calculate coverage
		const totalNodes = nodeIds.length;

		// Take top 3 concepts
		const dominantConceptIds = sortedConcepts.slice(0, 3).map(([id]) => id);

		// Calculate how many nodes are covered by dominant concepts
		const coveredNodeSet = new Set<string>();

		for (const conceptId of dominantConceptIds) {
			const concept = this.concepts.find(c => c.id === conceptId);
			if (concept) {
				for (const nodeId of concept.codeElements) {
					if (nodeIds.includes(nodeId)) {
						coveredNodeSet.add(nodeId);
					}
				}
			}
		}

		const coveredNodes = coveredNodeSet.size;

		// Calculate name coherence
		const fileNames: string[] = [];
		for (const nodeId of nodeIds) {
			const node = context.codeNodes.get(nodeId);
			if (node && node.name) {
				fileNames.push(node.name);
			}
		}

		const nameCoherence = this.calculateNameSimilarity(fileNames);

		// Calculate relationship density
		const relationshipDensity = this.calculateDirectoryRelationshipDensity(
			nodeIds,
			context,
		);

		// Calculate overall coherence
		const coverageScore = totalNodes > 0 ? coveredNodes / totalNodes : 0;
		const coherence =
			coverageScore * 0.5 + nameCoherence * 0.2 + relationshipDensity * 0.3;

		return {
			coherence,
			dominantConcepts: dominantConceptIds,
		};
	}

	/**
	 * Calculate the similarity between file names in a directory
	 */
	private calculateNameSimilarity(names: string[]): number {
		if (names.length < 2) return 0.5; // Default for too few names

		// Look for common patterns: prefixes, suffixes, words
		const commonPrefix = this.findLongestCommonPrefix(names);
		const commonSuffix = this.findLongestCommonSuffix(names);

		// Calculate similarity based on common patterns
		const prefixSimilarity =
			commonPrefix.length > 2 ? Math.min(1, commonPrefix.length / 8) : 0;

		const suffixSimilarity =
			commonSuffix.length > 2 ? Math.min(1, commonSuffix.length / 8) : 0;

		return Math.max(prefixSimilarity, suffixSimilarity, 0.1);
	}

	/**
	 * Find the longest common prefix among strings
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
	 */
	private findLongestCommonSuffix(strings: string[]): string {
		if (strings.length === 0) return '';
		if (strings.length === 1) return strings[0] || '';

		// Reverse all strings
		const reversed = strings.map(s => (s || '').split('').reverse().join(''));

		// Find the common prefix of reversed strings
		const commonReversedPrefix = this.findLongestCommonPrefix(reversed);

		// Reverse back to get the suffix
		return commonReversedPrefix.split('').reverse().join('');
	}

	/**
	 * Calculate the relationship density within a directory
	 */
	private calculateDirectoryRelationshipDensity(
		nodeIds: string[],
		context: SharedAnalysisContext,
	): number {
		if (nodeIds.length < 2) return 0.5; // Default for too few nodes

		let relationshipCount = 0;
		const totalPossibleRelationships =
			(nodeIds.length * (nodeIds.length - 1)) / 2;

		// Count relationships between nodes in this directory
		for (const relationship of context.relationships) {
			if (
				nodeIds.includes(relationship.sourceId) &&
				nodeIds.includes(relationship.targetId)
			) {
				relationshipCount++;
			}
		}

		return totalPossibleRelationships > 0
			? relationshipCount / totalPossibleRelationships
			: 0;
	}

	/**
	 * Calculate text similarity between two strings
	 */
	private calculateTextSimilarity(text1: string, text2: string): number {
		// Simple Jaccard similarity of words
		const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
		const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));

		return this.calculateJaccardSimilarity(words1, words2);
	}

	/**
	 * Find a common name pattern for nodes in a cluster
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
		return names[0]
			? this.normalizeConceptName(names[0]) + ' Component'
			: 'Component';
	}
}
