/**
 * Pattern Analyzer
 *
 * Discovers recurring patterns in the codebase by allowing them to emerge naturally
 * from the code's own structure rather than imposing predefined patterns.
 *
 * Follows emergent indexing principles by:
 * - Making zero assumptions about languages or structures
 * - Letting patterns emerge from observations
 * - Using evidence-based pattern recognition
 * - Building understanding from what is found, not what is expected
 */

import {v4 as uuidv4} from 'uuid';
import {
	EmergentAnalyzer,
	FileNode,
	CodeNode,
	CodePattern,
	PatternInstance,
	IndexingPhase,
	CodeNodeType,
} from '../unifiedTypes.js';

import {SharedAnalysisContext} from '../sharedAnalysisContext.js';

/**
 * PatternAnalyzer discovers recurring patterns in code organization, naming conventions,
 * and structural elements without imposing predefined expectations.
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
	private casingCounts: Record<string, number> = {};
	private prefixCounts: Record<string, number> = {};
	private suffixCounts: Record<string, number> = {};
	private directoryNames: Record<string, number> = {};
	private fileNamingPatterns: Record<string, string[]> = {};
	private totalNodesProcessed: number = 0;

	/**
	 * Initialize the analyzer with the shared context
	 */
	async initialize(context: SharedAnalysisContext): Promise<void> {
		// Reset state
		this.nodesByType = {};
		this.nameCounts = {};
		this.casingCounts = {};
		this.prefixCounts = {};
		this.suffixCounts = {};
		this.directoryNames = {};
		this.fileNamingPatterns = {};
		this.totalNodesProcessed = 0;

		context.recordEvent('analyzer-initialized', {analyzer: this.id});
	}

	/**
	 * Analyze each file to gather pattern-related information
	 */
	async analyzeFile(
		file: FileNode,
		content: string,
		context: SharedAnalysisContext,
	): Promise<void> {
		// Skip files without language - no pattern analysis possible
		if (!file.languageType) {
			return;
		}

		// Record directory information for organization pattern detection
		if (file.parent?.path) {
			const dirName = file.parent.path.split('/').pop() || '';
			if (dirName) {
				this.directoryNames[dirName] = (this.directoryNames[dirName] || 0) + 1;
			}
		}

		// Detect file naming patterns
		this.analyzeFileNaming(file);

		// Analyze content for patterns
		await this.analyzeCodeContent(file, content, context);

		// Collect code nodes for this file for later pattern analysis
		for (const node of context.codeNodes.values()) {
			if (node.path === file.path) {
				// Group node by type
				if (!this.nodesByType[node.type]) {
					this.nodesByType[node.type] = [];
				}
				this.nodesByType[node.type]?.push(node);

				// Analyze naming conventions
				this.analyzeNamingConvention(node);

				this.totalNodesProcessed++;
			}
		}
	}

	/**
	 * Process relationships between patterns after files have been analyzed
	 */
	async processRelationships(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.RELATIONSHIP_MAPPING) {
			return;
		}

		// Analyze relationships between patterns that have emerged

		// 1. Look for code nodes that share naming patterns
		const namingGroups: Record<string, string[]> = {};

		// Group nodes by naming patterns
		for (const node of context.codeNodes.values()) {
			// Skip nodes with empty or single-character names
			if (!node.name || node.name.length <= 1) continue;

			// Identify the casing style
			const casingStyle = this.detectCasingStyle(node.name);
			if (casingStyle) {
				if (!namingGroups[casingStyle]) {
					namingGroups[casingStyle] = [];
				}
				namingGroups[casingStyle].push(node.id);
			}

			// Check for suffix patterns
			const suffix = this.findSignificantSuffix(node.name);
			if (suffix) {
				const suffixPattern = `*${suffix}`;
				if (!namingGroups[suffixPattern]) {
					namingGroups[suffixPattern] = [];
				}
				namingGroups[suffixPattern].push(node.id);
			}

			// Check for prefix patterns
			const prefix = this.findSignificantPrefix(node.name);
			if (prefix) {
				const prefixPattern = `${prefix}*`;
				if (!namingGroups[prefixPattern]) {
					namingGroups[prefixPattern] = [];
				}
				namingGroups[prefixPattern].push(node.id);
			}
		}

		// Record the pattern relationships in node metadata for later use
		for (const [pattern, nodeIds] of Object.entries(namingGroups)) {
			if (nodeIds.length >= 3) {
				// Only consider patterns with multiple instances
				for (const nodeId of nodeIds) {
					const node = context.codeNodes.get(nodeId);
					if (node) {
						node.metadata = node.metadata || {};
						node.metadata['namingPatterns'] =
							node.metadata['namingPatterns'] || [];
						node.metadata['namingPatterns'].push(pattern);
					}
				}
			}
		}

		// Record event
		context.recordEvent('pattern-relationships-processed', {
			analyzer: this.id,
			patternGroups: Object.keys(namingGroups).length,
		});
	}

	/**
	 * Discover code patterns based on the collected information
	 */
	async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.PATTERN_DISCOVERY) {
			return;
		}

		const patterns: CodePattern[] = [];

		// Discover structural patterns
		patterns.push(...(await this.discoverStructuralPatterns(context)));

		// Discover naming convention patterns
		patterns.push(...(await this.discoverNamingPatterns(context)));

		// Discover file organization patterns
		patterns.push(...(await this.discoverOrganizationPatterns(context)));

		// Add discovered patterns to the context
		for (const pattern of patterns) {
			context.patterns.push(pattern);
		}

		// Register common patterns for other analyzers to use
		this.registerDiscoveredPatterns(context, patterns);

		context.recordEvent('patterns-discovered', {
			analyzer: this.id,
			count: patterns.length,
			types: {
				structural: patterns.filter(p => p.type === 'structural').length,
				naming: patterns.filter(p => p.type === 'naming').length,
				organization: patterns.filter(p => p.type === 'organization').length,
			},
		});
	}

	/**
	 * Final integration of pattern analysis with the codebase understanding
	 */
	async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.INTEGRATION) {
			return;
		}

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

		// Tag files with their pattern associations
		this.tagFilesWithPatterns(context);

		// Update root metadata with pattern summary
		context.fileSystem.metadata.patternSummary = {
			totalPatterns: context.patterns.length,
			patternsByType,
			dominantNamingConventions: this.getDominantNamingConventions(),
		};

		context.recordEvent('pattern-analysis-integrated', {
			analyzer: this.id,
			patternCount: context.patterns.length,
		});
	}

	/**
	 * Release resources
	 */
	async cleanup(): Promise<void> {
		// Reset state
		this.nodesByType = {};
		this.nameCounts = {};
		this.casingCounts = {};
		this.prefixCounts = {};
		this.suffixCounts = {};
		this.directoryNames = {};
		this.fileNamingPatterns = {};
		this.totalNodesProcessed = 0;
	}

	/**
	 * Analyze file naming patterns
	 */
	private analyzeFileNaming(file: FileNode): void {
		const name = file.name.replace(/\.[^.]+$/, ''); // Remove extension

		// Skip empty or too short names
		if (!name || name.length <= 1) return;

		// Detect casing style
		const casingStyle = this.detectCasingStyle(name);
		if (casingStyle) {
			if (!this.fileNamingPatterns[casingStyle]) {
				this.fileNamingPatterns[casingStyle] = [];
			}
			this.fileNamingPatterns[casingStyle].push(file.path);
		}

		// Check for common patterns in file names
		if (/\.test\.|\.spec\.|test\.|spec\./.test(file.name)) {
			if (!this.fileNamingPatterns['test']) {
				this.fileNamingPatterns['test'] = [];
			}
			this.fileNamingPatterns['test'].push(file.path);
		}

		// Find suffixes in file names
		for (const suffix of [
			'Component',
			'Service',
			'Controller',
			'Model',
			'View',
			'Util',
			'Helper',
			'Factory',
		]) {
			if (name.endsWith(suffix)) {
				const pattern = `*${suffix}`;
				if (!this.fileNamingPatterns[pattern]) {
					this.fileNamingPatterns[pattern] = [];
				}
				this.fileNamingPatterns[pattern].push(file.path);
				break;
			}
		}

		// Find prefixes in file names
		for (const prefix of [
			'use',
			'is',
			'get',
			'set',
			'create',
			'build',
			'make',
		]) {
			if (
				name.startsWith(prefix) &&
				name.length > prefix.length + 1 &&
				/[A-Z]/.test(name.charAt(prefix.length))
			) {
				const pattern = `${prefix}*`;
				if (!this.fileNamingPatterns[pattern]) {
					this.fileNamingPatterns[pattern] = [];
				}
				this.fileNamingPatterns[pattern].push(file.path);
				break;
			}
		}
	}

	/**
	 * Analyze code patterns in file content
	 */
	private async analyzeCodeContent(
		file: FileNode,
		content: string,
		context: SharedAnalysisContext,
	): Promise<void> {
		// Skip empty content
		if (!content.trim()) return;

		// Look for structural patterns in the content based on language type
		const language = file.languageType;

		// Add language information to file metadata
		file.metadata = file.metadata || {};
		file.metadata['language'] = language;

		// Count lines of code
		const lineCount = content.split('\n').length;
		file.metadata['lineCount'] = lineCount;

		// Language-agnostic pattern detection
		// Record detected patterns in file metadata

		// Look for class/interface definitions
		const classMatches = content.match(
			/\b(class|interface)\s+([A-Za-z0-9_]+)/g,
		);
		if (classMatches) {
			file.metadata['hasClasses'] = true;
			file.metadata['classCount'] = classMatches.length;
		}

		// Look for function/method definitions
		const functionMatches = content.match(
			/\b(function|def|func)\s+([A-Za-z0-9_]+)/g,
		);
		if (functionMatches) {
			file.metadata['hasFunctions'] = true;
			file.metadata['functionCount'] = functionMatches.length;
		}

		// Look for import/require statements
		const importMatches = content.match(
			/\b(import|require|from|using|include)\b/g,
		);
		if (importMatches) {
			file.metadata['hasImports'] = true;
			file.metadata['importCount'] = importMatches.length;
		}

		// Look for export statements
		const exportMatches = content.match(
			/\b(export|module\.exports|public|package)\b/g,
		);
		if (exportMatches) {
			file.metadata['hasExports'] = true;
			file.metadata['exportCount'] = exportMatches.length;
		}
	}

	/**
	 * Analyze naming conventions used in a code node
	 */
	private analyzeNamingConvention(node: CodeNode): void {
		const name = node.name;

		// Skip empty names or single-character names
		if (!name || name.length <= 1) return;

		// Count name occurrences
		this.nameCounts[name] = (this.nameCounts[name] || 0) + 1;

		// Check casing style
		const casingStyle = this.detectCasingStyle(name);
		if (casingStyle) {
			this.casingCounts[casingStyle] =
				(this.casingCounts[casingStyle] || 0) + 1;
		}

		// Check for common prefixes (3 chars or more)
		for (let i = 3; i <= Math.min(name.length / 2, 6); i++) {
			const prefix = name.substring(0, i);
			this.prefixCounts[prefix] = (this.prefixCounts[prefix] || 0) + 1;
		}

		// Check for common suffixes (3 chars or more)
		for (let i = 3; i <= Math.min(name.length / 2, 8); i++) {
			const suffix = name.substring(name.length - i);
			this.suffixCounts[suffix] = (this.suffixCounts[suffix] || 0) + 1;
		}
	}

	/**
	 * Discover structural patterns in the codebase
	 */
	private async discoverStructuralPatterns(
		context: SharedAnalysisContext,
	): Promise<CodePattern[]> {
		const patterns: CodePattern[] = [];

		// For each node type, discover common structures
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
				importance: this.calculatePatternImportance(type, nodes.length),
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

			// For specific node types, look for more detailed patterns
			if (type === CodeNodeType.CLASS.toString()) {
				patterns.push(...this.discoverClassPatterns(nodes, context));
			} else if (
				type === CodeNodeType.FUNCTION.toString() ||
				type === CodeNodeType.METHOD.toString()
			) {
				patterns.push(...this.discoverFunctionPatterns(nodes, context));
			}
		}

		return patterns;
	}

	/**
	 * Discover class-specific structural patterns
	 */
	private discoverClassPatterns(
		classNodes: CodeNode[],
		context: SharedAnalysisContext,
	): CodePattern[] {
		const patterns: CodePattern[] = [];

		// Look for common class naming patterns (e.g., *Service, *Controller)
		const classSuffixCounts: Record<string, string[]> = {};

		for (const node of classNodes) {
			for (const suffix of [
				'Service',
				'Controller',
				'Component',
				'Model',
				'Repository',
				'Factory',
				'Provider',
				'Manager',
			]) {
				if (node.name.endsWith(suffix)) {
					if (!classSuffixCounts[suffix]) {
						classSuffixCounts[suffix] = [];
					}
					classSuffixCounts[suffix].push(node.id);
					break;
				}
			}
		}

		// Create patterns for common class suffixes
		for (const [suffix, nodeIds] of Object.entries(classSuffixCounts)) {
			if (nodeIds.length >= 2) {
				// Need at least 2 instances
				patterns.push({
					id: uuidv4(),
					type: 'structural',
					name: `${suffix} class pattern`,
					description: `Classes with the ${suffix} suffix, suggesting a specific role`,
					signature: {
						nodeType: CodeNodeType.CLASS,
						namingSuffix: suffix,
					},
					instances: nodeIds.map(id => ({
						nodeId: id,
						nodePath: context.codeNodes.get(id)?.path || '',
						matchScore: 1.0,
						metadata: {},
					})),
					confidence: nodeIds.length / classNodes.length,
					frequency: nodeIds.length,
					importance:
						0.7 + 0.1 * Math.min(nodeIds.length / classNodes.length, 0.5),
				});
			}
		}

		return patterns;
	}

	/**
	 * Discover function-specific structural patterns
	 */
	private discoverFunctionPatterns(
		functionNodes: CodeNode[],
		context: SharedAnalysisContext,
	): CodePattern[] {
		const patterns: CodePattern[] = [];

		// Look for common function naming patterns (e.g., get*, is*, handle*)
		const functionPrefixCounts: Record<string, string[]> = {};

		for (const node of functionNodes) {
			for (const prefix of [
				'get',
				'set',
				'is',
				'has',
				'create',
				'build',
				'handle',
				'on',
				'use',
			]) {
				if (
					node.name.startsWith(prefix) &&
					node.name.length > prefix.length &&
					/[A-Z]/.test(node.name.charAt(prefix.length))
				) {
					if (!functionPrefixCounts[prefix]) {
						functionPrefixCounts[prefix] = [];
					}
					functionPrefixCounts[prefix].push(node.id);
					break;
				}
			}
		}

		// Create patterns for common function prefixes
		for (const [prefix, nodeIds] of Object.entries(functionPrefixCounts)) {
			if (nodeIds.length >= 3) {
				// Need at least 3 instances
				patterns.push({
					id: uuidv4(),
					type: 'structural',
					name: `${prefix}* function pattern`,
					description: `Functions starting with "${prefix}", suggesting a specific behavior`,
					signature: {
						nodeType: CodeNodeType.FUNCTION,
						namingPrefix: prefix,
					},
					instances: nodeIds.map(id => ({
						nodeId: id,
						nodePath: context.codeNodes.get(id)?.path || '',
						matchScore: 1.0,
						metadata: {},
					})),
					confidence: nodeIds.length / functionNodes.length,
					frequency: nodeIds.length,
					importance:
						0.6 + 0.1 * Math.min(nodeIds.length / functionNodes.length, 0.5),
				});
			}
		}

		return patterns;
	}

	/**
	 * Discover naming convention patterns that have emerged in the codebase
	 */
	private async discoverNamingPatterns(
		context: SharedAnalysisContext,
	): Promise<CodePattern[]> {
		const patterns: CodePattern[] = [];

		// Find dominant casing style by node type
		const caseStylesByType: Record<string, {style: string; count: number}> = {};

		for (const [nodeType, nodes] of Object.entries(this.nodesByType)) {
			// Skip if too few nodes
			if (nodes.length < 3) continue;

			// Count casing styles for this node type
			const styleCounts: Record<string, number> = {};

			for (const node of nodes) {
				const style = this.detectCasingStyle(node.name);
				if (style) {
					styleCounts[style] = (styleCounts[style] || 0) + 1;
				}
			}

			// Find the dominant style
			let dominantStyle = '';
			let maxCount = 0;
			for (const [style, count] of Object.entries(styleCounts)) {
				if (count > maxCount) {
					maxCount = count;
					dominantStyle = style;
				}
			}

			// Record if significant (used for > 50% of nodes)
			if (dominantStyle && maxCount / nodes.length > 0.5) {
				caseStylesByType[nodeType] = {
					style: dominantStyle,
					count: maxCount,
				};
			}
		}

		// Create patterns for dominant naming styles by node type
		for (const [nodeType, {style, count}] of Object.entries(caseStylesByType)) {
			// Get all nodes of this type
			const nodes = this.nodesByType[nodeType] || [];

			// Skip if too few nodes
			if (nodes.length < 3) continue;

			// Create the pattern
			patterns.push({
				id: uuidv4(),
				type: 'naming',
				name: `${nodeType} ${style} convention`,
				description: `${nodeType} elements use ${style} naming convention`,
				signature: {
					nodeType,
					casingStyle: style,
				},
				instances: nodes
					.filter(n => this.detectCasingStyle(n.name) === style)
					.map(node => ({
						nodeId: node.id,
						nodePath: node.path,
						matchScore: 1.0,
						metadata: {},
					})),
				confidence: count / nodes.length,
				frequency: count,
				importance: 0.7,
			});
		}

		// Discover significant prefixes and suffixes (used in at least 10% of eligible nodes)
		const significanceThreshold = Math.max(3, this.totalNodesProcessed * 0.1);

		// Add prefix patterns
		for (const [prefix, count] of Object.entries(this.prefixCounts)) {
			if (count >= significanceThreshold) {
				// Only include prefixes that are actually meaningful
				// Skip very common prefixes that might be coincidental
				if (['the', 'and', 'for'].includes(prefix.toLowerCase())) continue;

				// Find nodes with this prefix
				const nodesWithPrefix: CodeNode[] = [];
				for (const node of context.codeNodes.values()) {
					if (node.name.startsWith(prefix)) {
						nodesWithPrefix.push(node);
					}
				}

				// Group by node type to see if this prefix is specific to a type
				const typeCount: Record<string, number> = {};
				for (const node of nodesWithPrefix) {
					typeCount[node.type] = (typeCount[node.type] || 0) + 1;
				}

				// Find the dominant type
				let dominantType = '';
				let maxTypeCount = 0;
				for (const [type, typeNodes] of Object.entries(typeCount)) {
					if (typeNodes > maxTypeCount) {
						maxTypeCount = typeNodes;
						dominantType = type;
					}
				}

				// Create pattern
				patterns.push({
					id: uuidv4(),
					type: 'naming',
					name: `${prefix}* prefix convention`,
					description: dominantType
						? `${dominantType} elements commonly start with "${prefix}"`
						: `Common prefix "${prefix}" found in ${count} elements`,
					signature: {
						type: 'prefix',
						value: prefix,
						nodeType: dominantType || undefined,
					},
					instances: nodesWithPrefix.map(node => ({
						nodeId: node.id,
						nodePath: node.path,
						matchScore: 1.0,
						metadata: {},
					})),
					confidence: dominantType ? maxTypeCount / count : 0.6,
					frequency: count,
					importance: 0.6,
				});
			}
		}

		// Add suffix patterns
		for (const [suffix, count] of Object.entries(this.suffixCounts)) {
			if (count >= significanceThreshold) {
				// Skip common endings that might be coincidental
				if (['ing', 'ed', 'ion', 'er'].includes(suffix.toLowerCase())) continue;

				// Find nodes with this suffix
				const nodesWithSuffix: CodeNode[] = [];
				for (const node of context.codeNodes.values()) {
					if (node.name.endsWith(suffix)) {
						nodesWithSuffix.push(node);
					}
				}

				// Group by node type
				const typeCount: Record<string, number> = {};
				for (const node of nodesWithSuffix) {
					typeCount[node.type] = (typeCount[node.type] || 0) + 1;
				}

				// Find the dominant type
				let dominantType = '';
				let maxTypeCount = 0;
				for (const [type, typeNodes] of Object.entries(typeCount)) {
					if (typeNodes > maxTypeCount) {
						maxTypeCount = typeNodes;
						dominantType = type;
					}
				}

				// Create pattern
				patterns.push({
					id: uuidv4(),
					type: 'naming',
					name: `*${suffix} suffix convention`,
					description: dominantType
						? `${dominantType} elements commonly end with "${suffix}"`
						: `Common suffix "${suffix}" found in ${count} elements`,
					signature: {
						type: 'suffix',
						value: suffix,
						nodeType: dominantType || undefined,
					},
					instances: nodesWithSuffix.map(node => ({
						nodeId: node.id,
						nodePath: node.path,
						matchScore: 1.0,
						metadata: {},
					})),
					confidence: dominantType ? maxTypeCount / count : 0.6,
					frequency: count,
					importance: 0.6,
				});
			}
		}

		return patterns;
	}

	/**
	 * Discover patterns in file and directory organization
	 */
	private async discoverOrganizationPatterns(
		context: SharedAnalysisContext,
	): Promise<CodePattern[]> {
		const patterns: CodePattern[] = [];

		// Analyze file naming patterns
		for (const [pattern, files] of Object.entries(this.fileNamingPatterns)) {
			if (files.length >= 3) {
				// Need at least 3 instances
				patterns.push({
					id: uuidv4(),
					type: 'organization',
					name: `${pattern} file naming pattern`,
					description: `Files following the ${pattern} naming pattern`,
					signature: {
						type: 'file_naming',
						pattern,
					},
					instances: files.map(path => ({
						nodeId: `file:${path}`,
						nodePath: path,
						matchScore: 1.0,
						metadata: {},
					})),
					confidence: 0.8,
					frequency: files.length,
					importance: 0.6 + 0.1 * Math.min(files.length / 10, 0.3),
				});
			}
		}

		// Analyze directory structure patterns

		// Count the directory name occurrences
		const dirNameCounts = this.directoryNames;

		// Find significant directory names (used multiple times)
		for (const [dirName, count] of Object.entries(dirNameCounts)) {
			if (count >= 3) {
				// Skip very common/generic directory names that don't indicate a pattern
				if (['src', 'source', 'lib', 'app'].includes(dirName.toLowerCase()))
					continue;

				// For potentially meaningful directories, create patterns
				patterns.push({
					id: uuidv4(),
					type: 'organization',
					name: `${dirName} directory pattern`,
					description: `Files organized in "${dirName}" directories`,
					signature: {
						type: 'directory_structure',
						directoryName: dirName,
					},
					instances: [], // Would need to gather actual directory paths
					confidence: 0.7,
					frequency: count,
					importance: 0.6 + 0.1 * Math.min(count / 5, 0.3),
				});
			}
		}

		// Look for architectural patterns based on directory names
		const architecturalPatterns =
			this.detectArchitecturalPatterns(dirNameCounts);
		patterns.push(...architecturalPatterns);

		return patterns;
	}

	/**
	 * Detect architectural patterns based on directory names
	 */
	private detectArchitecturalPatterns(
		dirNameCounts: Record<string, number>,
	): CodePattern[] {
		const patterns: CodePattern[] = [];

		// Check for MVC pattern
		const hasModels = dirNameCounts['models'] || dirNameCounts['model'] || 0;
		const hasViews = dirNameCounts['views'] || dirNameCounts['view'] || 0;
		const hasControllers =
			dirNameCounts['controllers'] || dirNameCounts['controller'] || 0;

		if (hasModels && hasViews && hasControllers) {
			patterns.push({
				id: uuidv4(),
				type: 'organization',
				name: 'MVC architectural pattern',
				description: 'Code follows Model-View-Controller architectural pattern',
				signature: {
					type: 'architectural_pattern',
					pattern: 'mvc',
				},
				instances: [], // Would need actual directory paths
				confidence: 0.9,
				frequency: Math.min(hasModels, hasViews, hasControllers),
				importance: 0.9,
			});
		}

		// Check for MVVM pattern
		const hasViewModels =
			dirNameCounts['viewmodels'] || dirNameCounts['viewmodel'] || 0;

		if (hasModels && hasViews && hasViewModels) {
			patterns.push({
				id: uuidv4(),
				type: 'organization',
				name: 'MVVM architectural pattern',
				description: 'Code follows Model-View-ViewModel architectural pattern',
				signature: {
					type: 'architectural_pattern',
					pattern: 'mvvm',
				},
				instances: [], // Would need actual directory paths
				confidence: 0.9,
				frequency: Math.min(hasModels, hasViews, hasViewModels),
				importance: 0.9,
			});
		}

		// Check for service-oriented architecture
		const hasServices =
			dirNameCounts['services'] || dirNameCounts['service'] || 0;

		if (hasServices && hasServices >= 3) {
			patterns.push({
				id: uuidv4(),
				type: 'organization',
				name: 'Service-oriented architecture',
				description: 'Code follows service-oriented architectural pattern',
				signature: {
					type: 'architectural_pattern',
					pattern: 'service-oriented',
				},
				instances: [], // Would need actual directory paths
				confidence: 0.8,
				frequency: hasServices,
				importance: 0.8,
			});
		}

		return patterns;
	}

	/**
	 * Register the discovered patterns for other analyzers to use
	 */
	private registerDiscoveredPatterns(
		context: SharedAnalysisContext,
		patterns: CodePattern[],
	): void {
		// Register naming convention patterns
		const namingPatterns = patterns.filter(p => p.type === 'naming');
		for (const pattern of namingPatterns) {
			if (pattern.signature.casingStyle) {
				context.registerPattern({
					type: 'naming_convention',
					name: pattern.name,
					description: pattern.description,
					confidence: pattern.confidence,
					metadata: {
						casingStyle: pattern.signature.casingStyle,
						nodeType: pattern.signature.nodeType,
					},
				});
			} else if (pattern.signature.type === 'prefix') {
				context.registerPattern({
					type: 'naming_convention',
					name: pattern.name,
					description: pattern.description,
					confidence: pattern.confidence,
					metadata: {
						prefix: pattern.signature.value,
						nodeType: pattern.signature.nodeType,
					},
				});
			} else if (pattern.signature.type === 'suffix') {
				context.registerPattern({
					type: 'naming_convention',
					name: pattern.name,
					description: pattern.description,
					confidence: pattern.confidence,
					metadata: {
						suffix: pattern.signature.value,
						nodeType: pattern.signature.nodeType,
					},
				});
			}
		}

		// Register structural patterns
		const structuralPatterns = patterns.filter(p => p.type === 'structural');
		for (const pattern of structuralPatterns) {
			if (pattern.signature.nodeType) {
				context.registerPattern({
					type: 'structure',
					name: pattern.name,
					description: pattern.description,
					confidence: pattern.confidence,
					metadata: {
						nodeType: pattern.signature.nodeType,
						namingPrefix: pattern.signature.namingPrefix,
						namingSuffix: pattern.signature.namingSuffix,
					},
				});
			}
		}

		// Register architectural patterns
		const orgPatterns = patterns.filter(
			p =>
				p.type === 'organization' &&
				p.signature.type === 'architectural_pattern',
		);

		for (const pattern of orgPatterns) {
			context.registerPattern({
				type: 'architecture',
				name: pattern.name,
				description: pattern.description,
				confidence: pattern.confidence,
				metadata: {
					pattern: pattern.signature.pattern,
				},
			});
		}
	}

	/**
	 * Tag files with their associated patterns for easier lookup
	 */
	private tagFilesWithPatterns(context: SharedAnalysisContext): void {
		// For each pattern, tag the files/nodes it applies to
		for (const pattern of context.patterns) {
			for (const instance of pattern.instances) {
				// If it's a file pattern
				if (instance.nodeId.startsWith('file:')) {
					const filePath = instance.nodeId.substring(5); // Remove 'file:' prefix
					this.findAndTagFile(context, filePath, {
						patternId: pattern.id,
						patternType: pattern.type,
						patternName: pattern.name,
					});
				}
				// If it's a code node pattern
				else {
					const node = context.codeNodes.get(instance.nodeId);
					if (node) {
						node.metadata = node.metadata || {};
						node.metadata['patterns'] = node.metadata['patterns'] || [];
						node.metadata['patterns'].push({
							patternId: pattern.id,
							patternType: pattern.type,
							patternName: pattern.name,
						});
					}
				}
			}
		}
	}

	/**
	 * Find a file in the file system tree and tag it with pattern info
	 */
	private findAndTagFile(
		context: SharedAnalysisContext,
		filePath: string,
		patternInfo: any,
	): void {
		// Helper function to search recursively
		const search = (node: any): boolean => {
			if ('path' in node && node.path === filePath) {
				node.metadata = node.metadata || {};
				node.metadata.patterns = node.metadata.patterns || [];
				node.metadata.patterns.push(patternInfo);
				return true;
			}

			if ('children' in node && node.children) {
				for (const child of node.children) {
					if (search(child)) {
						return true;
					}
				}
			}

			return false;
		};

		search(context.fileSystem.root);
	}

	/**
	 * Get dominant naming conventions for different node types
	 */
	private getDominantNamingConventions(): Record<string, string> {
		const result: Record<string, string> = {};

		// For each node type, find the dominant casing style
		for (const [nodeType, nodes] of Object.entries(this.nodesByType)) {
			if (nodes.length < 3) continue;

			// Count casing styles for this node type
			const styleCounts: Record<string, number> = {};

			for (const node of nodes) {
				const style = this.detectCasingStyle(node.name);
				if (style) {
					styleCounts[style] = (styleCounts[style] || 0) + 1;
				}
			}

			// Find the dominant style
			let dominantStyle = '';
			let maxCount = 0;
			for (const [style, count] of Object.entries(styleCounts)) {
				if (count > maxCount) {
					maxCount = count;
					dominantStyle = style;
				}
			}

			// Only include if significant
			if (dominantStyle && maxCount / nodes.length > 0.5) {
				result[nodeType] = dominantStyle;
			}
		}

		return result;
	}

	/**
	 * Calculate importance of a pattern based on node type and frequency
	 */
	private calculatePatternImportance(
		nodeType: string,
		frequency: number,
	): number {
		// Higher importance for more common node types
		const baseImportance =
			{
				[CodeNodeType.CLASS]: 0.8,
				[CodeNodeType.INTERFACE]: 0.8,
				[CodeNodeType.FUNCTION]: 0.7,
				[CodeNodeType.METHOD]: 0.7,
				[CodeNodeType.PROPERTY]: 0.6,
				[CodeNodeType.VARIABLE]: 0.5,
				[CodeNodeType.CONSTANT]: 0.6,
				[CodeNodeType.ENUM]: 0.7,
				[CodeNodeType.TYPE]: 0.7,
			}[nodeType] || 0.5;

		// Adjust importance based on frequency (more instances = more important)
		// But with diminishing returns
		const frequencyAdjustment = Math.min(0.3, frequency * 0.01);

		return Math.min(1.0, baseImportance + frequencyAdjustment);
	}

	/**
	 * Detect the casing style of a string
	 */
	private detectCasingStyle(name: string): string | null {
		if (!name || name.length <= 1) return null;

		if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
			return 'PascalCase';
		} else if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
			return 'camelCase';
		} else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) {
			return 'snake_case';
		} else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
			return 'kebab-case';
		} else if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name)) {
			return 'CONSTANT_CASE';
		}

		return null;
	}

	/**
	 * Find significant prefix in a name
	 */
	private findSignificantPrefix(name: string): string | null {
		// Try prefixes with minimum length of 2 characters
		for (const prefix of [
			'get',
			'set',
			'is',
			'has',
			'use',
			'on',
			'handle',
			'create',
			'build',
			'make',
		]) {
			if (
				name.startsWith(prefix) &&
				name.length > prefix.length &&
				/[A-Z]/.test(name.charAt(prefix.length))
			) {
				return prefix;
			}
		}
		return null;
	}

	/**
	 * Find significant suffix in a name
	 */
	private findSignificantSuffix(name: string): string | null {
		// Try common suffixes
		for (const suffix of [
			'Component',
			'Service',
			'Controller',
			'Model',
			'Repository',
			'Factory',
			'Provider',
			'Manager',
			'Handler',
		]) {
			if (name.endsWith(suffix) && name.length > suffix.length) {
				return suffix;
			}
		}
		return null;
	}
}
