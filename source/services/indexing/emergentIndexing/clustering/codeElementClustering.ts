/**
 * Code Element Clustering
 *
 * Implements unsupervised clustering for code elements, allowing patterns to emerge organically.
 */

import {v4 as uuidv4} from 'uuid';
import {
	CodebaseUnderstanding,
	CodeNode,
	CodeCluster,
	ClusteringMetric,
	ClusteringAlgorithm,
	SimilarityMatrix,
} from '../types.js';

/**
 * Service for discovering natural clusters of code elements without predefined patterns
 */
export class CodeElementClustering {
	/**
	 * Cluster code elements based on their similarities
	 */
	async clusterCodeElements(
		understanding: CodebaseUnderstanding,
		options: {
			algorithm?: ClusteringAlgorithm;
			metrics?: ClusteringMetric[];
			minSimilarity?: number;
			maxClusters?: number;
		} = {},
	): Promise<CodeCluster[]> {
		console.log('Clustering code elements...');

		// Default options
		const defaultOptions = {
			algorithm: ClusteringAlgorithm.HIERARCHICAL,
			metrics: [
				ClusteringMetric.NAMING_PATTERN,
				ClusteringMetric.STRUCTURAL_SIMILARITY,
				ClusteringMetric.RELATIONSHIP_GRAPH,
			],
			minSimilarity: 0.6,
			maxClusters: 50,
		};

		const mergedOptions = {...defaultOptions, ...options};

		// Generate similarity matrix
		const similarityMatrix = await this.buildSimilarityMatrix(
			understanding,
			mergedOptions.metrics,
		);

		// Apply clustering algorithm
		const clusters = await this.applyClustering(
			understanding,
			similarityMatrix,
			mergedOptions,
		);

		console.log(`Discovered ${clusters.length} natural clusters`);

		return clusters;
	}

	/**
	 * Build a similarity matrix between all code nodes
	 * @private
	 */
	private async buildSimilarityMatrix(
		understanding: CodebaseUnderstanding,
		metrics: ClusteringMetric[],
	): Promise<SimilarityMatrix> {
		const codeNodes = Array.from(understanding.codeNodes.values());
		const matrix: SimilarityMatrix = new Map();

		// Initialize matrix
		for (const node1 of codeNodes) {
			const nodeMap = new Map<string, number>();
			matrix.set(node1.id, nodeMap);

			for (const node2 of codeNodes) {
				// Skip self comparison
				if (node1.id === node2.id) continue;

				// Compute similarity based on selected metrics
				const similarity = this.computeSimilarity(
					node1,
					node2,
					metrics,
					understanding,
				);
				nodeMap.set(node2.id, similarity);
			}
		}

		return matrix;
	}

	/**
	 * Compute similarity between two code nodes using multiple metrics
	 * @private
	 */
	private computeSimilarity(
		node1: CodeNode,
		node2: CodeNode,
		metrics: ClusteringMetric[],
		understanding: CodebaseUnderstanding,
	): number {
		// Skip comparison of different types (unless explicitly looking for cross-type patterns)
		if (node1.type !== node2.type) return 0;

		let totalSimilarity = 0;
		let totalWeight = 0;

		// Apply each metric
		for (const metric of metrics) {
			const {similarity, weight} = this.applySimilarityMetric(
				node1,
				node2,
				metric,
				understanding,
			);
			totalSimilarity += similarity * weight;
			totalWeight += weight;
		}

		return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
	}

	/**
	 * Apply a specific similarity metric between two nodes
	 * @private
	 */
	private applySimilarityMetric(
		node1: CodeNode,
		node2: CodeNode,
		metric: ClusteringMetric,
		understanding: CodebaseUnderstanding,
	): {similarity: number; weight: number} {
		switch (metric) {
			case ClusteringMetric.NAMING_PATTERN:
				return this.calculateNamingPatternSimilarity(node1, node2);

			case ClusteringMetric.STRUCTURAL_SIMILARITY:
				return this.calculateStructuralSimilarity(node1, node2);

			case ClusteringMetric.RELATIONSHIP_GRAPH:
				return this.calculateRelationshipGraphSimilarity(
					node1,
					node2,
					understanding,
				);

			case ClusteringMetric.SEMANTIC_SIMILARITY:
				return this.calculateSemanticSimilarity(node1, node2, understanding);

			case ClusteringMetric.CONTENT_SIMILARITY:
				return this.calculateContentSimilarity(node1, node2);

			default:
				return {similarity: 0, weight: 0};
		}
	}

	/**
	 * Calculate similarity based on naming patterns
	 * @private
	 */
	private calculateNamingPatternSimilarity(
		node1: CodeNode,
		node2: CodeNode,
	): {similarity: number; weight: number} {
		// No names to compare
		if (!node1.name || !node2.name) {
			return {similarity: 0, weight: 0};
		}

		// Calculate similarity metrics

		// 1. Prefix/suffix similarity
		const prefix1 = this.extractPrefix(node1.name);
		const prefix2 = this.extractPrefix(node2.name);
		const suffix1 = this.extractSuffix(node1.name);
		const suffix2 = this.extractSuffix(node2.name);

		const prefixSimilarity = prefix1 && prefix2 && prefix1 === prefix2 ? 1 : 0;
		const suffixSimilarity = suffix1 && suffix2 && suffix1 === suffix2 ? 1 : 0;

		// 2. Naming convention similarity (camelCase, PascalCase, etc.)
		const convention1 = this.detectNamingConvention(node1.name);
		const convention2 = this.detectNamingConvention(node2.name);
		const conventionSimilarity = convention1 === convention2 ? 1 : 0;

		// 3. Word overlap
		const words1 = this.extractWords(node1.name);
		const words2 = this.extractWords(node2.name);
		const commonWords = words1.filter(word => words2.includes(word)).length;
		const totalWords = new Set([...words1, ...words2]).size;
		const wordSimilarity = totalWords > 0 ? commonWords / totalWords : 0;

		// Combine all naming similarity aspects
		const similarity =
			prefixSimilarity * 0.3 +
			suffixSimilarity * 0.3 +
			conventionSimilarity * 0.1 +
			wordSimilarity * 0.3;

		return {similarity, weight: 1};
	}

	/**
	 * Calculate similarity based on code structure
	 * @private
	 */
	private calculateStructuralSimilarity(
		node1: CodeNode,
		node2: CodeNode,
	): {similarity: number; weight: number} {
		// Compare size and complexity
		const metadataSimilarity = this.compareMetadata(
			node1.metadata,
			node2.metadata,
		);

		// Compare children count and structure
		const childrenSimilarity = this.compareChildren(node1, node2);

		// Compare location sizes
		const locationSimilarity = this.compareLocations(
			node1.location,
			node2.location,
		);

		// Combine structural aspects
		const similarity =
			metadataSimilarity * 0.4 +
			childrenSimilarity * 0.4 +
			locationSimilarity * 0.2;

		return {similarity, weight: 1};
	}

	/**
	 * Calculate similarity based on relationship graphs
	 * @private
	 */
	private calculateRelationshipGraphSimilarity(
		node1: CodeNode,
		node2: CodeNode,
		understanding: CodebaseUnderstanding,
	): {similarity: number; weight: number} {
		// Extract relationships for both nodes
		const relationships1 = understanding.relationships.filter(
			rel => rel.sourceId === node1.id || rel.targetId === node1.id,
		);
		const relationships2 = understanding.relationships.filter(
			rel => rel.sourceId === node2.id || rel.targetId === node2.id,
		);

		// No relationships to compare
		if (relationships1.length === 0 || relationships2.length === 0) {
			return {similarity: 0, weight: 0};
		}

		// Compare relationship types
		const types1 = new Set(relationships1.map(rel => rel.type));
		const types2 = new Set(relationships2.map(rel => rel.type));

		const commonTypes = new Set([...types1].filter(type => types2.has(type)));
		const typeSimilarity =
			commonTypes.size / Math.max(types1.size, types2.size);

		// Compare relationship patterns (incoming vs outgoing)
		const incoming1 = relationships1.filter(
			rel => rel.targetId === node1.id,
		).length;
		// We'll only use incoming relationships for now
		// const outgoing1 = relationships1.filter(
		//	rel => rel.sourceId === node1.id,
		// ).length;

		const incoming2 = relationships2.filter(
			rel => rel.targetId === node2.id,
		).length;
		// We'll only use incoming relationships for now
		// const outgoing2 = relationships2.filter(
		//	rel => rel.sourceId === node2.id,
		// ).length;

		const incomingRatio1 =
			relationships1.length > 0 ? incoming1 / relationships1.length : 0;
		const incomingRatio2 =
			relationships2.length > 0 ? incoming2 / relationships2.length : 0;

		const relationshipPatternSimilarity =
			1 - Math.abs(incomingRatio1 - incomingRatio2);

		// Combine relationship aspects
		const similarity =
			typeSimilarity * 0.7 + relationshipPatternSimilarity * 0.3;

		return {similarity, weight: 1};
	}

	/**
	 * Calculate similarity based on semantic features
	 * @private
	 */
	private calculateSemanticSimilarity(
		node1: CodeNode,
		node2: CodeNode,
		understanding: CodebaseUnderstanding,
	): {similarity: number; weight: number} {
		// Find semantic units containing these nodes
		const units1 = understanding.semanticUnits.filter(unit =>
			unit.codeNodeIds.includes(node1.id),
		);
		const units2 = understanding.semanticUnits.filter(unit =>
			unit.codeNodeIds.includes(node2.id),
		);

		// No semantic information to compare
		if (units1.length === 0 || units2.length === 0) {
			return {similarity: 0, weight: 0};
		}

		// Count shared semantic units
		const unitIds1 = new Set(units1.map(unit => unit.id));
		const unitIds2 = new Set(units2.map(unit => unit.id));

		const sharedUnits = new Set([...unitIds1].filter(id => unitIds2.has(id)));
		const unitSimilarity =
			sharedUnits.size / Math.max(unitIds1.size, unitIds2.size);

		// Compare concepts
		const concepts1 = new Set(units1.flatMap(unit => unit.concepts));
		const concepts2 = new Set(units2.flatMap(unit => unit.concepts));

		const sharedConcepts = new Set(
			[...concepts1].filter(id => concepts2.has(id)),
		);
		const conceptSimilarity =
			Math.max(concepts1.size, concepts2.size) > 0
				? sharedConcepts.size / Math.max(concepts1.size, concepts2.size)
				: 0;

		// Combine semantic aspects
		const similarity = unitSimilarity * 0.5 + conceptSimilarity * 0.5;

		return {similarity, weight: 1};
	}

	/**
	 * Calculate similarity based on content
	 * @private
	 */
	private calculateContentSimilarity(
		node1: CodeNode,
		node2: CodeNode,
	): {similarity: number; weight: number} {
		// Skip if no content available
		if (
			typeof node1.content !== 'string' ||
			typeof node2.content !== 'string'
		) {
			return {similarity: 0, weight: 0};
		}

		// Simple line count comparison
		const lines1 = node1.content.split('\n').length;
		const lines2 = node2.content.split('\n').length;

		const lineSimilarity =
			1 - Math.abs(lines1 - lines2) / Math.max(lines1, lines2);

		// TODO: Implement more sophisticated content similarity (e.g., token-based comparison)

		return {similarity: lineSimilarity, weight: 0.5}; // Lower weight until better metrics
	}

	/**
	 * Extract prefix from a name
	 * @private
	 */
	private extractPrefix(name: string): string | null {
		// Look for common prefixes (up to 4 chars)
		for (let i = 3; i <= Math.min(4, name.length / 2); i++) {
			const prefix = name.substring(0, i);
			// Check if it's a meaningful prefix (not just first part of a word)
			if (
				['get', 'set', 'is', 'has', 'on', 'do', 'to', 'use'].includes(prefix)
			) {
				return prefix;
			}
		}
		return null;
	}

	/**
	 * Extract suffix from a name
	 * @private
	 */
	private extractSuffix(name: string): string | null {
		// Look for common suffixes
		const commonSuffixes = [
			'Component',
			'Service',
			'Provider',
			'Controller',
			'Model',
			'View',
			'Helper',
			'Utils',
			'Factory',
		];

		for (const suffix of commonSuffixes) {
			if (name.endsWith(suffix)) {
				return suffix;
			}
		}

		// Also check for file extensions in paths
		if (name.includes('.')) {
			return name.split('.').pop() || null;
		}

		return null;
	}

	/**
	 * Detect naming convention used in a name
	 * @private
	 */
	private detectNamingConvention(name: string): string {
		if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
			return 'PascalCase';
		} else if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
			return 'camelCase';
		} else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) {
			return 'snake_case';
		} else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
			return 'kebab-case';
		} else if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name)) {
			return 'UPPER_CASE';
		} else {
			return 'unknown';
		}
	}

	/**
	 * Extract words from a name
	 * @private
	 */
	private extractWords(name: string): string[] {
		// Handle different naming conventions

		// camelCase or PascalCase
		if (/[A-Z]/.test(name)) {
			return name
				.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
				.toLowerCase()
				.split(/\s+/);
		}

		// snake_case
		if (name.includes('_')) {
			return name.toLowerCase().split('_').filter(Boolean);
		}

		// kebab-case
		if (name.includes('-')) {
			return name.toLowerCase().split('-').filter(Boolean);
		}

		// Unknown format, just return the name as a single word
		return [name.toLowerCase()];
	}

	/**
	 * Compare metadata between nodes
	 * @private
	 */
	private compareMetadata(
		metadata1: Record<string, any> | undefined,
		metadata2: Record<string, any> | undefined,
	): number {
		if (!metadata1 || !metadata2) return 0;

		// Get all keys from both metadata objects
		const allKeys = new Set([
			...Object.keys(metadata1),
			...Object.keys(metadata2),
		]);
		if (allKeys.size === 0) return 0;

		let matchingKeys = 0;
		let matchingValues = 0;

		for (const key of allKeys) {
			// Check if both have this key
			if (key in metadata1 && key in metadata2) {
				matchingKeys++;

				// Check if values are similar
				if (metadata1[key] === metadata2[key]) {
					matchingValues++;
				}
			}
		}

		// Compute similarity as weighted average of key matches and value matches
		const keySimilarity = matchingKeys / allKeys.size;
		const valueSimilarity =
			matchingKeys > 0 ? matchingValues / matchingKeys : 0;

		return keySimilarity * 0.4 + valueSimilarity * 0.6;
	}

	/**
	 * Compare children structure
	 * @private
	 */
	private compareChildren(node1: CodeNode, node2: CodeNode): number {
		const children1 = node1.children || [];
		const children2 = node2.children || [];

		// Compare children count
		const maxChildren = Math.max(children1.length, children2.length);
		if (maxChildren === 0) return 1; // Both have no children, perfect match

		const countSimilarity =
			1 - Math.abs(children1.length - children2.length) / maxChildren;

		// If either has no children, just return count similarity
		if (children1.length === 0 || children2.length === 0) {
			return countSimilarity;
		}

		// Compare children types distribution
		const types1 = this.countByType(children1);
		const types2 = this.countByType(children2);

		const allTypes = new Set([...Object.keys(types1), ...Object.keys(types2)]);

		let typeDiffSum = 0;
		for (const type of allTypes) {
			const count1 = types1[type] || 0;
			const count2 = types2[type] || 0;
			typeDiffSum += Math.abs(count1 - count2);
		}

		const typeSimilarity = 1 - typeDiffSum / (2 * maxChildren);

		// Combine children similarities
		return countSimilarity * 0.5 + typeSimilarity * 0.5;
	}

	/**
	 * Count children by type
	 * @private
	 */
	private countByType(children: CodeNode[]): Record<string, number> {
		const result: Record<string, number> = {};

		for (const child of children) {
			result[child.type] = (result[child.type] || 0) + 1;
		}

		return result;
	}

	/**
	 * Compare code locations
	 * @private
	 */
	private compareLocations(
		location1: CodeNode['location'] | undefined,
		location2: CodeNode['location'] | undefined,
	): number {
		if (!location1 || !location2) return 0;

		// Calculate size of each code block
		const size1 = location1.end.line - location1.start.line + 1;
		const size2 = location2.end.line - location2.start.line + 1;

		// Compute similarity as inverse of normalized size difference
		const maxSize = Math.max(size1, size2);
		const sizeDiff = Math.abs(size1 - size2);

		return 1 - sizeDiff / maxSize;
	}

	/**
	 * Apply clustering algorithm to similarity matrix
	 * @private
	 */
	private async applyClustering(
		understanding: CodebaseUnderstanding,
		similarityMatrix: SimilarityMatrix,
		options: {
			algorithm: ClusteringAlgorithm;
			minSimilarity: number;
			maxClusters: number;
		},
	): Promise<CodeCluster[]> {
		switch (options.algorithm) {
			case ClusteringAlgorithm.HIERARCHICAL:
				return this.applyHierarchicalClustering(
					understanding,
					similarityMatrix,
					options,
				);

			case ClusteringAlgorithm.DBSCAN:
				return this.applyDBSCANClustering(
					understanding,
					similarityMatrix,
					options,
				);

			default:
				return this.applyHierarchicalClustering(
					understanding,
					similarityMatrix,
					options,
				);
		}
	}

	/**
	 * Apply hierarchical clustering algorithm
	 * @private
	 */
	private async applyHierarchicalClustering(
		understanding: CodebaseUnderstanding,
		similarityMatrix: SimilarityMatrix,
		options: {
			minSimilarity: number;
			maxClusters: number;
		},
	): Promise<CodeCluster[]> {
		// Initialize each node as its own cluster
		const nodes = Array.from(understanding.codeNodes.values());
		let clusters: Map<string, Set<string>> = new Map();

		for (const node of nodes) {
			clusters.set(node.id, new Set([node.id]));
		}

		// Merge clusters until min similarity threshold is reached
		let merged = true;
		while (merged && clusters.size > 1) {
			merged = false;

			// Find the most similar pair of clusters
			let bestSimilarity = 0;
			let bestPair: [string, string] | null = null;

			const clusterIds = Array.from(clusters.keys());

			for (let i = 0; i < clusterIds.length; i++) {
				const clusterId1 = clusterIds[i];
				const cluster1 = clusters.get(clusterId1 || '');
				if (!cluster1) continue;

				for (let j = i + 1; j < clusterIds.length; j++) {
					const clusterId2 = clusterIds[j];
					const cluster2 = clusters.get(clusterId2 || '');
					if (!cluster2) continue;

					// Calculate average similarity between clusters
					const similarity = this.calculateClusterSimilarity(
						cluster1,
						cluster2,
						similarityMatrix,
					);

					if (similarity > bestSimilarity) {
						bestSimilarity = similarity;
						bestPair = [clusterId1 || '', clusterId2 || ''];
					}
				}
			}

			// If we found a pair to merge and it's above threshold
			if (bestPair && bestSimilarity >= options.minSimilarity) {
				const [clusterId1, clusterId2] = bestPair;

				// Merge the clusters
				const cluster1 = clusters.get(clusterId1);
				const cluster2 = clusters.get(clusterId2);

				if (cluster1 && cluster2) {
					// Create a new merged cluster
					const mergedCluster = new Set([...cluster1, ...cluster2]);

					// Generate a new ID for the merged cluster
					const mergedId = uuidv4();

					// Add the new cluster
					clusters.set(mergedId, mergedCluster);

					// Remove the original clusters
					clusters.delete(clusterId1);
					clusters.delete(clusterId2);

					merged = true;
				}
			}

			// Break if we've reached the desired number of clusters
			if (clusters.size <= options.maxClusters) {
				break;
			}
		}

		// Convert to the CodeCluster format
		const result: CodeCluster[] = [];

		for (const [clusterId, nodeIds] of clusters.entries()) {
			// Skip singleton clusters
			if (nodeIds.size <= 1) continue;

			// Calculate cluster properties
			const clusterNodes = Array.from(nodeIds)
				.map(id => understanding.codeNodes.get(id))
				.filter(Boolean) as CodeNode[];

			const dominantType = this.findDominantValue(
				clusterNodes.map(node => node.type),
			);
			const namingPatterns = this.detectNamingPatterns(clusterNodes);

			result.push({
				id: clusterId,
				name: `${dominantType} cluster (${nodeIds.size} nodes)`,
				description: `A cluster of ${nodeIds.size} ${dominantType} nodes with similar characteristics`,
				nodeIds: Array.from(nodeIds),
				dominantType,
				namingPatterns,
				confidence: 0.7, // Default confidence
				metadata: {
					size: nodeIds.size,
					averageSimilarity: this.calculateAverageSimilarity(
						nodeIds,
						similarityMatrix,
					),
				},
			});
		}

		return result;
	}

	/**
	 * Apply DBSCAN clustering algorithm
	 * @private
	 */
	private async applyDBSCANClustering(
		understanding: CodebaseUnderstanding,
		similarityMatrix: SimilarityMatrix,
		options: {
			minSimilarity: number;
			maxClusters: number;
		},
	): Promise<CodeCluster[]> {
		const nodes = Array.from(understanding.codeNodes.values());
		const nodeIds = nodes.map(node => node.id);

		// Track which nodes have been visited
		const visited = new Set<string>();

		// Assign each node to a cluster (or noise)
		const clusterAssignments: Map<string, string> = new Map();
		let clusterIdCounter = 0;

		// Function to expand a cluster
		const expandCluster = (
			nodeId: string,
			neighbors: string[],
			clusterId: string,
		) => {
			// Add the current node to the cluster
			clusterAssignments.set(nodeId, clusterId);

			// Process each neighbor
			for (let i = 0; i < neighbors.length; i++) {
				const neighborId = neighbors[i];

				// Skip if already visited
				if (visited.has(neighborId || '')) continue;

				// Mark as visited
				visited.add(neighborId || '');

				// Find the neighbor's neighbors
				const neighborNeighbors = this.findNeighbors(
					neighborId || '',
					similarityMatrix,
					options.minSimilarity,
				);

				// If this neighbor has enough neighbors, add them to the processing list
				if (neighborNeighbors.length >= 1) {
					neighbors.push(...neighborNeighbors.filter(id => !visited.has(id)));
				}

				// Add this neighbor to the cluster if not already in one
				if (!clusterAssignments.has(neighborId || '')) {
					clusterAssignments.set(neighborId || '', clusterId);
				}
			}
		};

		// Process each node
		for (const nodeId of nodeIds) {
			// Skip if already visited
			if (visited.has(nodeId)) continue;

			// Mark as visited
			visited.add(nodeId);

			// Find neighbors
			const neighbors = this.findNeighbors(
				nodeId,
				similarityMatrix,
				options.minSimilarity,
			);

			// If not enough neighbors, mark as noise
			if (neighbors.length < 1) {
				clusterAssignments.set(nodeId, 'NOISE');
				continue;
			}

			// Create a new cluster
			const clusterId = `cluster_${clusterIdCounter++}`;

			// Expand the cluster
			expandCluster(nodeId, neighbors, clusterId);
		}

		// Group nodes by cluster
		const clusters = new Map<string, Set<string>>();

		for (const [nodeId, clusterId] of clusterAssignments.entries()) {
			// Skip noise
			if (clusterId === 'NOISE') continue;

			if (!clusters.has(clusterId)) {
				clusters.set(clusterId, new Set());
			}

			clusters.get(clusterId)?.add(nodeId);
		}

		// Convert to the CodeCluster format
		const result: CodeCluster[] = [];

		for (const [clusterId, nodeIds] of clusters.entries()) {
			// Skip singleton clusters
			if (nodeIds.size <= 1) continue;

			// Calculate cluster properties
			const clusterNodes = Array.from(nodeIds)
				.map(id => understanding.codeNodes.get(id))
				.filter(Boolean) as CodeNode[];

			const dominantType = this.findDominantValue(
				clusterNodes.map(node => node.type),
			);
			const namingPatterns = this.detectNamingPatterns(clusterNodes);

			result.push({
				id: clusterId,
				name: `${dominantType} cluster (${nodeIds.size} nodes)`,
				description: `A cluster of ${nodeIds.size} ${dominantType} nodes with similar characteristics`,
				nodeIds: Array.from(nodeIds),
				dominantType,
				namingPatterns,
				confidence: 0.7, // Default confidence
				metadata: {
					size: nodeIds.size,
					averageSimilarity: this.calculateAverageSimilarity(
						nodeIds,
						similarityMatrix,
					),
				},
			});
		}

		return result;
	}

	/**
	 * Find neighbors of a node based on similarity
	 * @private
	 */
	private findNeighbors(
		nodeId: string,
		similarityMatrix: SimilarityMatrix,
		minSimilarity: number,
	): string[] {
		const neighbors: string[] = [];
		const nodeMatrix = similarityMatrix.get(nodeId);

		if (!nodeMatrix) return neighbors;

		for (const [neighborId, similarity] of nodeMatrix.entries()) {
			if (similarity >= minSimilarity) {
				neighbors.push(neighborId);
			}
		}

		return neighbors;
	}

	/**
	 * Calculate similarity between two clusters
	 * @private
	 */
	private calculateClusterSimilarity(
		cluster1: Set<string>,
		cluster2: Set<string>,
		similarityMatrix: SimilarityMatrix,
	): number {
		let totalSimilarity = 0;
		let comparisonCount = 0;

		// Compare each node in cluster1 with each node in cluster2
		for (const nodeId1 of cluster1) {
			for (const nodeId2 of cluster2) {
				const nodeMatrix = similarityMatrix.get(nodeId1);
				if (nodeMatrix) {
					const similarity = nodeMatrix.get(nodeId2) || 0;
					totalSimilarity += similarity;
					comparisonCount++;
				}
			}
		}

		// Return average similarity
		return comparisonCount > 0 ? totalSimilarity / comparisonCount : 0;
	}

	/**
	 * Calculate average similarity within a cluster
	 * @private
	 */
	private calculateAverageSimilarity(
		nodeIds: Set<string> | string[],
		similarityMatrix: SimilarityMatrix,
	): number {
		const ids = Array.from(nodeIds);

		let totalSimilarity = 0;
		let comparisonCount = 0;

		// Compare each pair of nodes
		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) {
				const nodeMatrix = similarityMatrix.get(ids[i] || '');
				if (nodeMatrix) {
					const similarity = nodeMatrix.get(ids[j] || '') || 0;
					totalSimilarity += similarity;
					comparisonCount++;
				}
			}
		}

		// Return average similarity
		return comparisonCount > 0 ? totalSimilarity / comparisonCount : 0;
	}

	/**
	 * Find the most common value in an array
	 * @private
	 */
	private findDominantValue<T>(values: T[]): T {
		const counts = new Map<T, number>();

		for (const value of values) {
			counts.set(value, (counts.get(value) || 0) + 1);
		}

		let maxCount = 0;
		// TypeScript doesn't understand that we checked values.length in the map iteration
	// This assertion is safe because we only get here if there's at least one value
	let dominant = values[0] as T;

		for (const [value, count] of counts.entries()) {
			if (count > maxCount) {
				maxCount = count;
				dominant = value;
			}
		}

		return dominant;
	}

	/**
	 * Detect naming patterns in a cluster of nodes
	 * @private
	 */
	private detectNamingPatterns(nodes: CodeNode[]): string[] {
		const patterns: string[] = [];

		// Check for prefix patterns
		const prefixes = nodes
			.map(node => this.extractPrefix(node.name || ''))
			.filter(Boolean) as string[];

		if (prefixes.length > 0) {
			const dominantPrefix = this.findDominantValue(prefixes);
			if (
				prefixes.filter(p => p === dominantPrefix).length >=
				nodes.length * 0.5
			) {
				patterns.push(`prefix:${dominantPrefix}`);
			}
		}

		// Check for suffix patterns
		const suffixes = nodes
			.map(node => this.extractSuffix(node.name || ''))
			.filter(Boolean) as string[];

		if (suffixes.length > 0) {
			const dominantSuffix = this.findDominantValue(suffixes);
			if (
				suffixes.filter(s => s === dominantSuffix).length >=
				nodes.length * 0.5
			) {
				patterns.push(`suffix:${dominantSuffix}`);
			}
		}

		// Check for naming convention patterns
		const conventions = nodes
			.map(node => this.detectNamingConvention(node.name || ''))
			.filter(conv => conv !== 'unknown');

		if (conventions.length > 0) {
			const dominantConvention = this.findDominantValue(conventions);
			if (
				conventions.filter(c => c === dominantConvention).length >=
				nodes.length * 0.7
			) {
				patterns.push(`convention:${dominantConvention}`);
			}
		}

		return patterns;
	}
}
