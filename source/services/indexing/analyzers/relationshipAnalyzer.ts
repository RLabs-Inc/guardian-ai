/**
 * Relationship Analyzer
 *
 * Discovers relationships between elements in the codebase by letting the code's
 * own structure speak for itself, identifying connections organically without
 * imposing predefined structures.
 */

import {v4 as uuidv4} from 'uuid';
import path from 'path';
import {
	EmergentAnalyzer,
	FileNode,
	Relationship,
	RelationshipType,
	CodeNodeType,
	IndexingPhase,
} from '../unifiedTypes.js';

import {SharedAnalysisContext} from '../sharedAnalysisContext.js';

/**
 * RelationshipAnalyzer discovers connections between code elements by analyzing:
 * - Containment relationships (directories/files/modules)
 * - Import/export relationships between modules
 * - Inheritance relationships (extends/implements)
 * - Similar files based on naming patterns and content
 */
export class RelationshipAnalyzer implements EmergentAnalyzer {
	readonly id: string = 'relationship-analyzer';
	readonly name: string = 'Relationship Analyzer';
	readonly priority: number = 40; // Run after language detection
	readonly dependencies: string[] = ['language-detector']; // Needs language info

	// Temporary storage of relationship candidates
	private containmentRelationships: Relationship[] = [];
	private importExportRelationships: Relationship[] = [];
	private inheritanceRelationships: Relationship[] = [];
	private similarityRelationships: Relationship[] = [];
	private namePatterns: Map<string, string[]> = new Map(); // Pattern -> [filePath]
	private fileExtensionMap: Map<string, FileNode[]> = new Map(); // Extension -> [fileNode]

	/**
	 * Initialize the analyzer with the shared context
	 */
	async initialize(context: SharedAnalysisContext): Promise<void> {
		// Reset internal state
		this.containmentRelationships = [];
		this.importExportRelationships = [];
		this.inheritanceRelationships = [];
		this.similarityRelationships = [];
		this.namePatterns = new Map();
		this.fileExtensionMap = new Map();

		context.recordEvent('analyzer-initialized', {analyzer: this.id});
	}

	/**
	 * Analyze each file to gather essential information needed for relationship detection
	 */
	async analyzeFile(
		file: FileNode,
		content: string,
		context: SharedAnalysisContext,
	): Promise<void> {
		// Group files by extension for later similarity analysis
		const ext = file.extension.toLowerCase();
		if (!this.fileExtensionMap.has(ext)) {
			this.fileExtensionMap.set(ext, []);
		}
		this.fileExtensionMap.get(ext)?.push(file);

		// Detect immediate containment relationships
		if (file.parent) {
			this.containmentRelationships.push({
				id: uuidv4(),
				type: RelationshipType.CONTAINS,
				sourceId: `directory:${file.parent.path}`,
				targetId: `file:${file.path}`,
				metadata: {
					containmentType: 'directory_file',
				},
				weight: 1.0,
				confidence: 1.0,
			});
		}

		// Do initial detection of import/export and inheritance relationships
		// This is a preliminary scan that will be refined in processRelationships
		if (file.languageType) {
			this.detectImportsInFile(file, content);
			this.detectInheritanceInFile(file, content);
		}

		// Extract naming pattern from the file for similarity detection
		const basename = path.basename(file.path, file.extension);
		const pattern = this.extractNamePattern(basename);

		if (pattern !== '*') {
			if (!this.namePatterns.has(pattern)) {
				this.namePatterns.set(pattern, []);
			}
			this.namePatterns.get(pattern)?.push(file.path);
		}

		// We'll use the pattern in the file metadata for future reference
		file.metadata['namePattern'] = pattern;
	}

	/**
	 * Process all relationships after files have been analyzed
	 */
	async processRelationships(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.RELATIONSHIP_MAPPING) {
			return;
		}

		// 1. Find module-code containment relationships in the codebase
		this.detectCodeContainmentRelationships(context);

		// 2. Analyze all module relationships
		await this.refineImportRelationships(context);

		// 3. Complete inheritance relationship analysis
		this.refineInheritanceRelationships(context);

		// 4. Detect similarity between files with matching patterns
		this.detectSimilarFiles();

		// 5. Register all discovered relationships with the context
		const relationships = [
			...this.containmentRelationships,
			...this.importExportRelationships,
			...this.inheritanceRelationships,
			...this.similarityRelationships,
		];

		context.relationships.push(...relationships);

		// Record metrics
		context.recordMetric('relationship_count', relationships.length);
		context.recordMetric(
			'containment_relationships',
			this.containmentRelationships.length,
		);
		context.recordMetric(
			'import_export_relationships',
			this.importExportRelationships.length,
		);
		context.recordMetric(
			'inheritance_relationships',
			this.inheritanceRelationships.length,
		);
		context.recordMetric(
			'similarity_relationships',
			this.similarityRelationships.length,
		);

		context.recordEvent('relationships-processed', {
			analyzer: this.id,
			count: relationships.length,
			types: {
				containment: this.containmentRelationships.length,
				importExport: this.importExportRelationships.length,
				inheritance: this.inheritanceRelationships.length,
				similarity: this.similarityRelationships.length,
			},
		});
	}

	/**
	 * Discover relationship patterns in the codebase
	 */
	async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.PATTERN_DISCOVERY) {
			return;
		}

		// Define and register relationship patterns based on what we've observed

		// 1. Import patterns (common import paths, import styles)
		const importPathCounts: Record<string, number> = {};

		for (const rel of this.importExportRelationships) {
			if (rel.type === RelationshipType.IMPORTS && rel.metadata.importPath) {
				const importPath = rel.metadata['importPath'] as string;
				importPathCounts[importPath] = (importPathCounts[importPath] || 0) + 1;
			}
		}

		// Register common import patterns (those used multiple times)
		for (const [importPath, count] of Object.entries(importPathCounts)) {
			if (count >= 3) {
				// Threshold for pattern recognition
				context.registerPattern({
					type: 'import_pattern',
					name: `Common import: ${importPath}`,
					description: `Files commonly import from ${importPath}`,
					confidence: 0.8,
					metadata: {
						path: importPath,
						frequency: count,
					},
				});
			}
		}

		// 2. File naming patterns (from our similarity analysis)
		for (const [pattern, filePaths] of this.namePatterns.entries()) {
			if (filePaths.length >= 3) {
				// Only register patterns with multiple instances
				context.registerPattern({
					type: 'naming_pattern',
					name: `File pattern: ${pattern}`,
					description: `Files following the ${pattern} naming pattern`,
					confidence: 0.7,
					metadata: {
						pattern,
						count: filePaths.length,
						examples: filePaths.slice(0, 3), // Include a few examples
					},
				});
			}
		}

		// 3. Inheritance patterns (common base classes/interfaces)
		const extendsCounts: Record<string, number> = {};
		const implementsCounts: Record<string, number> = {};

		for (const rel of this.inheritanceRelationships) {
			const targetId = rel.targetId;
			if (rel.type === RelationshipType.EXTENDS) {
				extendsCounts[targetId] = (extendsCounts[targetId] || 0) + 1;
			} else if (rel.type === RelationshipType.IMPLEMENTS) {
				implementsCounts[targetId] = (implementsCounts[targetId] || 0) + 1;
			}
		}

		// Register common base classes
		for (const [targetId, count] of Object.entries(extendsCounts)) {
			if (count >= 2) {
				// At least two classes extend this one
				const baseNode = context.codeNodes.get(targetId);
				if (baseNode) {
					context.registerPattern({
						type: 'inheritance_pattern',
						name: `Common base class: ${baseNode.name}`,
						description: `${count} classes extend ${baseNode.name}`,
						confidence: 0.8,
						metadata: {
							baseClass: baseNode.name,
							baseClassId: targetId,
							count,
						},
					});
				}
			}
		}

		// Register common interfaces
		for (const [targetId, count] of Object.entries(implementsCounts)) {
			if (count >= 2) {
				// At least two classes implement this interface
				const interfaceNode = context.codeNodes.get(targetId);
				if (interfaceNode) {
					context.registerPattern({
						type: 'inheritance_pattern',
						name: `Common interface: ${interfaceNode.name}`,
						description: `${count} classes implement ${interfaceNode.name}`,
						confidence: 0.8,
						metadata: {
							interface: interfaceNode.name,
							interfaceId: targetId,
							count,
						},
					});
				}
			}
		}
	}

	/**
	 * Final integration phase
	 */
	async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.INTEGRATION) {
			return;
		}

		// Record relationship distribution by type
		const relationshipTypeDistribution: Record<string, number> = {};

		for (const rel of context.relationships) {
			relationshipTypeDistribution[rel.type] =
				(relationshipTypeDistribution[rel.type] || 0) + 1;
		}

		// Add this to context metadata
		context.fileSystem.metadata.relationshipTypeDistribution =
			relationshipTypeDistribution;

		// Free up memory
		this.clearTemporaryData();
	}

	/**
	 * Release resources
	 */
	async cleanup(): Promise<void> {
		this.clearTemporaryData();
	}

	/**
	 * Clear temporary storage to free memory
	 */
	private clearTemporaryData(): void {
		this.containmentRelationships = [];
		this.importExportRelationships = [];
		this.inheritanceRelationships = [];
		this.similarityRelationships = [];
		this.namePatterns.clear();
		this.fileExtensionMap.clear();
	}

	/**
	 * Detect initial import/export relationships in a file
	 */
	private detectImportsInFile(file: FileNode, content: string): void {
		// Skip if no content to analyze
		if (!content.trim()) return;

		// Simple regex to find imports (language-agnostic approach)
		// This uses less specific patterns to capture imports across different languages

		// JavaScript/TypeScript style imports
		const jsImportMatches = content.match(
			/import\s+(?:{[^}]+}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g,
		);

		if (jsImportMatches) {
			for (const match of jsImportMatches) {
				const modulePathMatch = match.match(/from\s+['"]([^'"]+)['"]/);
				if (modulePathMatch && modulePathMatch[1]) {
					// Store as a candidate - we'll resolve the actual target later
					this.importExportRelationships.push({
						id: uuidv4(),
						type: RelationshipType.IMPORTS,
						sourceId: `file:${file.path}`,
						targetId: 'pending', // Will be resolved later
						metadata: {
							importPath: modulePathMatch[1],
							sourceFilePath: file.path,
							importType: 'es_module',
						},
						weight: 1.0,
						confidence: 0.7, // Initial confidence is moderate
					});
				}
			}
		}

		// CommonJS require
		const requireMatches = content.match(
			/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
		);

		if (requireMatches) {
			for (const match of requireMatches) {
				const modulePathMatch = match.match(
					/require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
				);
				if (modulePathMatch && modulePathMatch[1]) {
					this.importExportRelationships.push({
						id: uuidv4(),
						type: RelationshipType.IMPORTS,
						sourceId: `file:${file.path}`,
						targetId: 'pending',
						metadata: {
							importPath: modulePathMatch[1],
							sourceFilePath: file.path,
							importType: 'commonjs',
						},
						weight: 1.0,
						confidence: 0.7,
					});
				}
			}
		}

		// Python imports
		const pythonImportMatches = content.match(
			/(?:from\s+([^\s]+)\s+)?import\s+([^\s]+)/g,
		);

		if (pythonImportMatches) {
			for (const match of pythonImportMatches) {
				let modulePath = '';
				const fromMatch = match.match(/from\s+([^\s]+)\s+import/);
				const importMatch = match.match(/import\s+([^\s]+)/);

				if (fromMatch && fromMatch[1]) {
					modulePath = fromMatch[1];
				} else if (importMatch && importMatch[1]) {
					modulePath = importMatch[1];
				}

				if (modulePath) {
					this.importExportRelationships.push({
						id: uuidv4(),
						type: RelationshipType.IMPORTS,
						sourceId: `file:${file.path}`,
						targetId: 'pending',
						metadata: {
							importPath: modulePath,
							sourceFilePath: file.path,
							importType: 'python',
						},
						weight: 1.0,
						confidence: 0.7,
					});
				}
			}
		}
	}

	/**
	 * Detect inheritance relationships in a file
	 */
	private detectInheritanceInFile(file: FileNode, content: string): void {
		// Skip if no content to analyze
		if (!content.trim()) return;

		// This initial implementation is language-agnostic and pattern-based
		// We store the patterns found and resolve them in processRelationships

		// Detect "extends" patterns (primarily for class inheritance)
		const extendsMatches = content.match(
			/\b(class|interface)\s+(\w+)(?:\s+extends\s+([^\s{]+))?/g,
		);

		if (extendsMatches) {
			for (const match of extendsMatches) {
				const parts = match.match(
					/\b(class|interface)\s+(\w+)(?:\s+extends\s+([^\s{]+))?/,
				);
				if (parts && parts.length >= 4 && parts[3]) {
					this.inheritanceRelationships.push({
						id: uuidv4(),
						type: RelationshipType.EXTENDS,
						sourceId: `file:${file.path}#${parts[2]}`,
						targetId: `pending:${parts[3]}`, // Will be resolved later
						metadata: {
							sourceType: parts[1],
							sourceName: parts[2],
							targetName: parts[3],
							sourceFilePath: file.path,
						},
						weight: 1.0,
						confidence: 0.8,
					});
				}
			}
		}

		// Detect "implements" patterns (primarily for interface implementation)
		const implementsMatches = content.match(
			/\bclass\s+(\w+)(?:\s+extends\s+[^\s{]+)?(?:\s+implements\s+([^{]+))?/g,
		);

		if (implementsMatches) {
			for (const match of implementsMatches) {
				const parts = match.match(
					/\bclass\s+(\w+)(?:\s+extends\s+[^\s{]+)?(?:\s+implements\s+([^{]+))?/,
				);
				if (parts && parts.length >= 3 && parts[2]) {
					// Handle multiple interfaces (comma-separated list)
					const interfaceList = parts[2].trim().split(/\s*,\s*/);

					for (const interfaceName of interfaceList) {
						this.inheritanceRelationships.push({
							id: uuidv4(),
							type: RelationshipType.IMPLEMENTS,
							sourceId: `file:${file.path}#${parts[1]}`,
							targetId: `pending:${interfaceName}`,
							metadata: {
								sourceName: parts[1],
								targetName: interfaceName,
								sourceFilePath: file.path,
							},
							weight: 1.0,
							confidence: 0.8,
						});
					}
				}
			}
		}
	}

	/**
	 * Detect code containment relationships (files containing code nodes)
	 */
	private detectCodeContainmentRelationships(
		context: SharedAnalysisContext,
	): void {
		// Add file-module relationships
		for (const node of context.codeNodes.values()) {
			// Find the corresponding file for each code node
			const filePath = node.path;
			if (filePath) {
				this.containmentRelationships.push({
					id: uuidv4(),
					type: RelationshipType.CONTAINS,
					sourceId: `file:${filePath}`,
					targetId: node.id,
					metadata: {
						containmentType: 'file_code',
						nodeType: node.type,
					},
					weight: 1.0,
					confidence: 1.0,
				});
			}

			// Also capture parent-child code node relationships
			if (node.parent && node.parent.id) {
				this.containmentRelationships.push({
					id: uuidv4(),
					type: RelationshipType.CONTAINS,
					sourceId: node.parent.id,
					targetId: node.id,
					metadata: {
						containmentType: 'code_code',
						parentType: node.parent.type,
						childType: node.type,
					},
					weight: 1.0,
					confidence: 1.0,
				});
			}
		}
	}

	/**
	 * Refine and resolve import relationships
	 */
	private async refineImportRelationships(
		context: SharedAnalysisContext,
	): Promise<void> {
		// Create a set of existing file paths for lookup
		const filePathSet = new Set<string>();

		const findAllFilePaths = (node: any): void => {
			if ('path' in node) {
				filePathSet.add(node.path);
			}

			if ('children' in node && node.children) {
				for (const child of node.children) {
					findAllFilePaths(child);
				}
			}
		};

		findAllFilePaths(context.fileSystem.root);

		// Remove the pending imports and replace with resolved ones
		const resolvedImports: Relationship[] = [];

		for (const rel of this.importExportRelationships) {
			if (rel.metadata['importPath'] && rel.metadata['ssourceFilePath']) {
				const sourcePath = rel.metadata['sourceFilePath'] as string;
				const importPath = rel.metadata['importPath'] as string;

				// Try to resolve the import path to an actual file
				const possibleTargetPaths = this.resolveImportPath(
					sourcePath,
					importPath,
					filePathSet,
				);

				for (const targetPath of possibleTargetPaths) {
					if (targetPath) {
						resolvedImports.push({
							id: uuidv4(),
							type: RelationshipType.IMPORTS,
							sourceId: `file:${sourcePath}`,
							targetId: `file:${targetPath}`,
							metadata: {
								...rel.metadata,
								resolvedPath: targetPath,
							},
							weight: rel.weight,
							confidence:
								possibleTargetPaths.length > 1
									? rel.confidence * 0.9
									: rel.confidence, // Reduce confidence if ambiguous
						});
					}
				}
			}
		}

		// Replace the imports with resolved ones
		this.importExportRelationships = resolvedImports;
	}

	/**
	 * Refine inheritance relationships by resolving class and interface references
	 */
	private refineInheritanceRelationships(context: SharedAnalysisContext): void {
		// Build a map of class/interface names to their node IDs
		const nameToNodeId: Record<string, string[]> = {};

		// Build the map for lookup
		for (const node of context.codeNodes.values()) {
			if (
				node.type === CodeNodeType.CLASS ||
				node.type === CodeNodeType.INTERFACE
			) {
				if (!nameToNodeId[node.name]) {
					nameToNodeId[node.name] = [];
				}
				nameToNodeId[node.name]?.push(node.id);
			}
		}

		// Now resolve the pending inheritance relationships
		const resolvedInheritance: Relationship[] = [];

		for (const rel of this.inheritanceRelationships) {
			if (rel.targetId.startsWith('pending:')) {
				const targetName = rel.targetId.substring(8); // Remove 'pending:' prefix
				const targetNodeIds = nameToNodeId[targetName];

				if (targetNodeIds && targetNodeIds.length > 0) {
					// If we find one or more matching nodes, create relationships
					for (const targetId of targetNodeIds) {
						resolvedInheritance.push({
							id: uuidv4(),
							type: rel.type,
							sourceId: rel.sourceId,
							targetId: targetId,
							metadata: {
								...rel.metadata,
								ambiguous: targetNodeIds.length > 1,
							},
							weight: rel.weight,
							confidence:
								targetNodeIds.length > 1
									? rel.confidence * 0.9
									: rel.confidence, // Reduce confidence if ambiguous
						});
					}
				} else {
					// If no matching node, keep relationship but mark it unresolved
					resolvedInheritance.push({
						id: uuidv4(),
						type: rel.type,
						sourceId: rel.sourceId,
						targetId: `unresolved:${targetName}`,
						metadata: {
							...rel.metadata,
							unresolved: true,
						},
						weight: rel.weight,
						confidence: rel.confidence * 0.5, // Lower confidence for unresolved
					});
				}
			} else {
				// Keep existing resolved relationships
				resolvedInheritance.push(rel);
			}
		}

		// Replace with resolved relationships
		this.inheritanceRelationships = resolvedInheritance;
	}

	/**
	 * Detect similar files based on naming patterns
	 */
	private detectSimilarFiles(): void {
		// Process files with the same naming pattern
		for (const [pattern, filePaths] of this.namePatterns.entries()) {
			if (filePaths.length < 2 || pattern === '*') continue;

			// Create relationships between all files with this pattern
			for (let i = 0; i < filePaths.length; i++) {
				for (let j = i + 1; j < filePaths.length; j++) {
					this.similarityRelationships.push({
						id: uuidv4(),
						type: RelationshipType.SIMILAR_TO,
						sourceId: `file:${filePaths[i]}`,
						targetId: `file:${filePaths[j]}`,
						metadata: {
							pattern,
							reason: 'name_pattern',
						},
						weight: 0.8,
						confidence: 0.7,
					});
				}
			}
		}

		// Also find similarity by directory structure
		// Group files by containing directory
		const dirToFiles: Record<string, string[]> = {};

		for (const files of this.fileExtensionMap.values()) {
			for (const file of files) {
				const dirPath = path.dirname(file.path);
				if (!dirToFiles[dirPath]) {
					dirToFiles[dirPath] = [];
				}
				dirToFiles[dirPath].push(file.path);
			}
		}

		// Create similarity relationships for files in the same directory
		// that share the same extension
		for (const [, files] of Object.entries(dirToFiles)) {
			if (files.length < 2) continue;

			// Group by extension
			const filesByExt: Record<string, string[]> = {};

			for (const filePath of files) {
				const ext = path.extname(filePath).toLowerCase();
				if (!filesByExt[ext]) {
					filesByExt[ext] = [];
				}
				filesByExt[ext].push(filePath);
			}

			// Create relationships between files with the same extension in the same directory
			for (const [ext, extFiles] of Object.entries(filesByExt)) {
				if (extFiles.length < 2) continue;

				for (let i = 0; i < extFiles.length; i++) {
					for (let j = i + 1; j < extFiles.length; j++) {
						this.similarityRelationships.push({
							id: uuidv4(),
							type: RelationshipType.SIMILAR_TO,
							sourceId: `file:${extFiles[i]}`,
							targetId: `file:${extFiles[j]}`,
							metadata: {
								reason: 'same_directory_same_extension',
								extension: ext,
							},
							weight: 0.7,
							confidence: 0.6,
						});
					}
				}
			}
		}
	}

	/**
	 * Extract a pattern from a filename using organic discovery
	 * rather than predefined patterns
	 */
	private extractNamePattern(name: string): string {
		// Rather than hardcoding patterns, we look for structural signatures

		// React-style component naming (PascalCase)
		if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
			return 'PascalCase';
		}

		// camelCase naming (common for functions, variables)
		if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
			return 'camelCase';
		}

		// kebab-case naming (common for files)
		if (/^[a-z][\-a-z0-9]*$/.test(name)) {
			return 'kebab-case';
		}

		// snake_case naming
		if (/^[a-z][_a-z0-9]*$/.test(name)) {
			return 'snake_case';
		}

		// Test file pattern
		if (
			name.includes('.test') ||
			name.includes('.spec') ||
			name.startsWith('test')
		) {
			return 'test';
		}

		// File with common suffixes
		for (const suffix of [
			'Controller',
			'Service',
			'Component',
			'Provider',
			'Factory',
			'Helper',
			'Util',
			'Model',
			'View',
		]) {
			if (name.endsWith(suffix)) {
				return `*${suffix}`;
			}
		}

		// React hook pattern
		if (
			name.startsWith('use') &&
			name.length > 3 &&
			/[A-Z]/.test(name.charAt(3))
		) {
			return 'useHook';
		}

		// If no specific pattern is recognized, use a generic placeholder
		return '*';
	}

	/**
	 * Try to resolve an import path to actual files in the codebase
	 */
	private resolveImportPath(
		sourcePath: string,
		importPath: string,
		filePathSet: Set<string>,
	): string[] {
		const possiblePaths: string[] = [];

		// Case 1: Absolute import (starts with /)
		if (importPath.startsWith('/')) {
			// Try direct match
			if (filePathSet.has(importPath)) {
				possiblePaths.push(importPath);
			}

			// Try with extensions
			for (const ext of [
				'.js',
				'.ts',
				'.jsx',
				'.tsx',
				'.json',
				'.mjs',
				'.cjs',
			]) {
				if (filePathSet.has(`${importPath}${ext}`)) {
					possiblePaths.push(`${importPath}${ext}`);
				}
			}

			// Try with index files
			for (const ext of ['.js', '.ts', '.jsx', '.tsx']) {
				if (filePathSet.has(`${importPath}/index${ext}`)) {
					possiblePaths.push(`${importPath}/index${ext}`);
				}
			}
		}

		// Case 2: Relative import (starts with ./ or ../)
		else if (importPath.startsWith('./') || importPath.startsWith('../')) {
			const sourceDir = path.dirname(sourcePath);
			const resolvedPath = path.resolve(sourceDir, importPath);

			// Try direct match
			if (filePathSet.has(resolvedPath)) {
				possiblePaths.push(resolvedPath);
			}

			// Try with extensions
			for (const ext of [
				'.js',
				'.ts',
				'.jsx',
				'.tsx',
				'.json',
				'.mjs',
				'.cjs',
			]) {
				if (filePathSet.has(`${resolvedPath}${ext}`)) {
					possiblePaths.push(`${resolvedPath}${ext}`);
				}
			}

			// Try with index files
			for (const ext of ['.js', '.ts', '.jsx', '.tsx']) {
				if (filePathSet.has(`${resolvedPath}/index${ext}`)) {
					possiblePaths.push(`${resolvedPath}/index${ext}`);
				}
			}
		}

		// Case 3: Package/module import (no leading . or /)
		else {
			// First check if it's a node_modules dependency
			if (filePathSet.has(`node_modules/${importPath}`)) {
				possiblePaths.push(`node_modules/${importPath}`);
			}

			// Then check for any files that end with this module name
			const basename = path.basename(importPath);
			for (const filePath of filePathSet) {
				if (
					filePath.endsWith(`/${basename}.js`) ||
					filePath.endsWith(`/${basename}.ts`) ||
					filePath.endsWith(`/${basename}.jsx`) ||
					filePath.endsWith(`/${basename}.tsx`)
				) {
					possiblePaths.push(filePath);
				}
			}

			// Check for any module files that match this whole path (common in package imports)
			for (const filePath of filePathSet) {
				if (
					filePath.endsWith(`/${importPath}.js`) ||
					filePath.endsWith(`/${importPath}.ts`) ||
					filePath.endsWith(`/${importPath}.jsx`) ||
					filePath.endsWith(`/${importPath}.tsx`)
				) {
					possiblePaths.push(filePath);
				}
			}
		}

		return possiblePaths;
	}
}
