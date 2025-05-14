/**
 * Dependency Analyzer
 *
 * Discovers and analyzes dependencies between code elements by letting the codebase speak for itself.
 * Following emergent indexing principles, it makes zero assumptions about languages, frameworks,
 * or project structure, instead discovering dependency patterns organically.
 */

import path from 'path';
import {v4 as uuidv4} from 'uuid';
import {
	EmergentAnalyzer,
	FileNode,
	DirectoryNode,
	Dependency,
	DependencyType,
	ImportStatement,
	ExportStatement,
	IndexingPhase,
	RelationshipType,
} from '../unifiedTypes.js';

import {SharedAnalysisContext} from '../sharedAnalysisContext.js';

/**
 * DependencyAnalyzer discovers dependencies between code elements without making
 * assumptions about programming languages, frameworks, or code organization.
 */
export class DependencyAnalyzer implements EmergentAnalyzer {
	// Core analyzer properties
	readonly id: string = 'dependency-analyzer';
	readonly name: string = 'Dependency Analyzer';
	readonly priority: number = 50; // Run after language and relationship detection
	readonly dependencies: string[] = [
		'language-detector',
		'relationship-analyzer',
	];

	// Analysis state
	private discoveredPatterns: Map<
		string,
		{regex: RegExp; type: string; confidence: number}
	> = new Map();
	private dependencyMap: Map<string, Dependency> = new Map();
	private imports: ImportStatement[] = [];
	private exports: ExportStatement[] = [];
	private fileConnections: Map<string, Set<string>> = new Map();
	private patternSamples: string[] = [];
	private significantKeywords: string[] = [];
	private dependencyLinePatterns: string[] = [];
	private patternLanguageMap: Map<string, Set<string>> = new Map();
	private moduleNameFrequency: Map<string, number> = new Map();

	/**
	 * Initialize the analyzer with the shared context
	 */
	async initialize(context: SharedAnalysisContext): Promise<void> {
		// Reset state
		this.discoveredPatterns = new Map();
		this.dependencyMap = new Map();
		this.imports = [];
		this.exports = [];
		this.fileConnections = new Map();
		this.patternSamples = [];
		this.moduleNameFrequency = new Map();

		context.recordEvent('analyzer-initialized', {analyzer: this.id});
	}

	/**
	 * Analyze each file to discover dependency patterns and extract relationships
	 */
	async analyzeFile(
		file: FileNode,
		content: string,
		context: SharedAnalysisContext,
	): Promise<void> {
		// In early phases, collect samples to discover patterns
		if (context.currentPhase === IndexingPhase.CONTENT_ANALYSIS) {
			// Limit the number of samples and file size for performance
			if (
				this.patternSamples.length < 100 &&
				content.length < 100000 &&
				content.length > 100
			) {
				this.patternSamples.push(content);
			}

			// Record file in connection map for later relationship analysis
			this.fileConnections.set(file.path, new Set());
		}

		// In later phases, apply discovered patterns and extract dependencies
		if (context.currentPhase === IndexingPhase.RELATIONSHIP_MAPPING) {
			if (this.discoveredPatterns.size === 0) {
				// Before processing files, discover patterns from collected samples
				this.discoverDependencyPatterns(context);
			}

			this.extractDependencies(file, content, context);
		}
	}

	/**
	 * Process relationships between code elements
	 */
	async processRelationships(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.RELATIONSHIP_MAPPING) {
			return;
		}

		// Use existing relationships to enrich dependency understanding
		await this.enrichWithRelationships(context);

		// Identify module structures from file relationships
		await this.identifyModuleStructures(context);

		// Store the results in the context
		context.dependencies = {
			dependencies: this.dependencyMap,
			imports: this.imports,
			exports: this.exports,
		};

		// Record metrics
		context.recordMetric('dependency_count', this.dependencyMap.size);
		context.recordMetric('import_statement_count', this.imports.length);
		context.recordMetric('export_statement_count', this.exports.length);

		context.recordEvent('dependencies-analyzed', {
			analyzer: this.id,
			dependencyCount: this.dependencyMap.size,
			importCount: this.imports.length,
			exportCount: this.exports.length,
		});
	}

	/**
	 * Discover patterns from dependency relationships
	 */
	async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.PATTERN_DISCOVERY) {
			return;
		}

		// Register discovered dependency patterns
		for (const [patternId, pattern] of this.discoveredPatterns.entries()) {
			context.registerPattern({
				type: pattern.type,
				name: `Dependency pattern: ${patternId}`,
				regex: pattern.regex.source,
				flags: pattern.regex.flags,
				description: 'Organically discovered dependency pattern',
				confidence: pattern.confidence,
			});
		}

		// Find and register dependency architectural patterns
		const architecturalPatterns =
			this.findDependencyArchitecturalPatterns(context);

		for (const pattern of architecturalPatterns) {
			context.registerPattern({
				type: 'dependency_architecture',
				name: pattern.name,
				description: pattern.description,
				confidence: pattern.confidence,
				metadata: pattern.metadata,
			});
		}

		_context.recordEvent('dependency-patterns-discovered', {
			analyzer: this.id,
			patternCount: this.discoveredPatterns.size,
			architecturalPatternCount: architecturalPatterns.length,
		});
	}

	/**
	 * Integrate dependency analysis into the codebase understanding
	 */
	async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
		if (context.currentPhase !== IndexingPhase.INTEGRATION) {
			return;
		}

		// Add dependency information to file metadata
		this.annotateFilesWithDependencyInfo(context);

		// Create dependency relationships if they don't already exist
		this.createDependencyRelationships(context);

		// Add module structure information to the understanding
		this.addModuleStructureInfo(context);

		context.recordEvent('dependency-analysis-integrated', {
			analyzer: this.id,
			dependencyCount: this.dependencyMap.size,
		});
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		this.discoveredPatterns.clear();
		this.dependencyMap.clear();
		this.imports = [];
		this.exports = [];
		this.fileConnections.clear();
		this.patternSamples = [];
		this.moduleNameFrequency.clear();
	}

	/**
	 * Discover dependency patterns from collected content samples
	 */
	private discoverDependencyPatterns(_context: SharedAnalysisContext): void {
		if (this.patternSamples.length === 0) {
			return;
		}

		// Combine all samples for analysis
		const combinedContent = this.patternSamples.join('\n\n');

		// We'll discover patterns based on evidence we find in the code

		// 1. Find path-like strings in quotes
		this.discoverPathPatterns(combinedContent);

		// 2. Find connection keywords (import, require, include, etc.)
		this.discoverConnectionKeywords(combinedContent);

		// 3. Find lines containing both connection keywords and path-like strings
		this.discoverDependencyLines(combinedContent);

		// 4. Build generalized patterns from discovered dependency lines
		this.buildRegexPatterns();

		// Log discovery results
		_context.recordEvent('dependency-patterns-discovered', {
			patternCount: this.discoveredPatterns.size,
			patternTypes: Array.from(this.discoveredPatterns.values()).map(
				p => p.type,
			),
		});
	}

	/**
	 * Discover path patterns in code (strings that look like paths/modules)
	 */
	private discoverPathPatterns(content: string): void {
		// Path-like strings in quotes - we'll consider both single and double quotes
		// This is language-agnostic and looks for things that could be module references
		const singleQuotePaths = content.match(/[']([@\w\-/.~]+)['']/g) || [];
		const doubleQuotePaths = content.match(/["]([@\w\-/.~]+)["]/g) || [];

		// Extract paths and count frequency
		const pathCounts = new Map<string, number>();

		const processPaths = (paths: string[] | RegExpMatchArray, _quoteChar: string) => {
			for (const match of paths) {
				// Extract just the path part
				const path = match.substring(1, match.length - 1);

				// Skip very short paths or likely non-module paths
				if (path.length < 2 || path.includes(' ') || path.includes('\t')) {
					continue;
				}

				// Record the path and increment its count
				pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
			}
		};

		if (singleQuotePaths && singleQuotePaths.length > 0) {
			processPaths(singleQuotePaths, "'");
		}
		if (doubleQuotePaths && doubleQuotePaths.length > 0) {
			processPaths(doubleQuotePaths, '"');
		}

		// Keep track of common module names for later use
		for (const [path, count] of pathCounts.entries()) {
			if (count >= 2) {
				// Only consider paths that appear multiple times
				// Extract the module name (first part of path)
				const moduleName = path.split('/')[0];
				if (moduleName) {
					this.moduleNameFrequency.set(
						moduleName,
						(this.moduleNameFrequency.get(moduleName) || 0) + count,
					);
				}
			}
		}
	}

	/**
	 * Discover connection keywords in the code (words that might indicate dependencies)
	 */
	private discoverConnectionKeywords(content: string): void {
		// Look for words that might indicate dependencies in various languages
		// This is intentionally broad to work across many languages
		const potentialKeywords = [
			'import',
			'require',
			'include',
			'using',
			'from',
			'use',
			'load',
			'import_module',
			'require_once',
			'include_once',
			'needs',
			'depends',
			'package',
			'module',
			'library',
			'extern',
			'extern\\"',
			'include\\"',
			'#include',
			'#import',
			'#require',
			'@import',
			'@use',
		];

		// Count keyword occurrences
		const keywordCounts = new Map<string, number>();

		for (const keyword of potentialKeywords) {
			// Use word boundaries for accuracy
			const regex = new RegExp(`\\b${keyword}\\b`, 'g');
			const matches = content.match(regex) || [];

			if (matches.length > 0) {
				keywordCounts.set(keyword, matches.length);
			}
		}

		// Identify keywords that appear frequently enough to be significant
		const totalLines = content.split('\n').length;
		const significanceThreshold = Math.max(3, Math.round(totalLines * 0.001)); // At least 0.1% of lines

		this.significantKeywords = Array.from(keywordCounts.entries())
			.filter(([_, count]) => count >= significanceThreshold)
			.map(([keyword, _]) => keyword);
	}

	/**
	 * Discover lines containing both connection keywords and path-like strings
	 */
	private discoverDependencyLines(content: string): void {
		// If we don't have significant keywords, use fallback keywords
		const keywords = this.significantKeywords || [
			'import',
			'require',
			'include',
			'using',
			'from',
		];

		// Find lines containing both keywords and path-like strings
		const lines = content.split('\n');
		const dependencyLines = new Map<string, number>();

		for (const line of lines) {
			const trimmed = line.trim();
			// Skip empty or very short lines
			if (trimmed.length < 5) continue;

			// Check if the line contains any of our keywords
			const hasKeyword = keywords.some(keyword =>
				new RegExp(`\\b${keyword}\\b`, 'i').test(trimmed),
			);

			// Check if the line contains a path-like string
			const hasPath = /['"]([^'"]+)['"]/.test(trimmed);

			// If it has both, it might be a dependency declaration
			if (hasKeyword && hasPath) {
				dependencyLines.set(trimmed, (dependencyLines.get(trimmed) || 0) + 1);
			}
		}

		// Store the most frequent dependency lines as potential patterns
		this.dependencyLinePatterns = Array.from(dependencyLines.entries())
			.filter(([_, count]) => count >= 2) // Appear at least twice
			.sort((a, b) => b[1] - a[1]) // Sort by frequency
			.map(([line, _]) => line);
	}

	/**
	 * Build regex patterns from discovered dependency lines
	 */
	private buildRegexPatterns(): void {
		if (
			!this.dependencyLinePatterns ||
			this.dependencyLinePatterns.length === 0
		) {
			return;
		}

		// For each dependency line pattern, try to generalize it into a regex
		for (let i = 0; i < Math.min(this.dependencyLinePatterns.length, 20); i++) {
			const line = this.dependencyLinePatterns[i];

			try {
				// Determine if this is an import or export pattern
				const isImport = line ? /\b(import|require|include|using|from|use)\b/i.test(
					line
				) : false;
				const isExport = line ? 
					/\b(export|module\.exports|package|return|public)\b/i.test(line) : false;

				const type = isImport ? 'import' : isExport ? 'export' : 'unknown';

				// Skip unknown types
				if (type === 'unknown') continue;

				// Generalize the pattern
				if (!line) continue;
				const generalizedPattern = this.generalizePattern(line, type);

				// Add to discovered patterns
				this.discoveredPatterns.set(`pattern_${i}`, {
					regex: generalizedPattern,
					type,
					confidence: 0.7 + 0.2 * Math.min(1, i / 10), // Higher confidence for more frequent patterns
				});
			} catch (e) {
				// Skip invalid patterns
				continue;
			}
		}
	}

	/**
	 * Generalize a specific code line into a regex pattern
	 */
	private generalizePattern(line: string, type: string): RegExp {
		// Create a generalized version of the line that will match similar patterns
		// This is intentionally broad to capture similar patterns

		let pattern = line
			// Escape regex special characters
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			// Make whitespace flexible
			.replace(/\s+/g, '\\s+')
			// Replace quoted strings with capture groups
			.replace(/(['"])[^'"]*\1/g, '[\'\\"](\\S+?)[\'\\"\\)]')
			// Replace identifiers with flexible patterns
			.replace(/\b[a-zA-Z_]\w*\b(?!\s*:)/g, '\\w+');

		// Make the pattern more robust based on type
		if (type === 'import') {
			// Make sure we capture the module name - it's the most important part
			pattern = pattern.replace(/\\(['"])\\S\\+\\?\\1/g, '$1([^$1]+)$1');
		} else if (type === 'export') {
			// For exports, make sure we capture what's being exported
			pattern = pattern.replace(
				/\b(export|module\.exports)\b/,
				'\\b(export|module\\.exports)\\b',
			);
		}

		return new RegExp(pattern, 'g');
	}

	/**
	 * Extract dependencies from a file using discovered patterns
	 */
	private extractDependencies(
		file: FileNode,
		content: string,
		context: SharedAnalysisContext,
	): void {
		// Apply all discovered patterns to find dependencies
		for (const [patternId, pattern] of this.discoveredPatterns.entries()) {
			const {regex, type, confidence} = pattern;

			// Skip patterns that don't match this file type
			// This is emergent - we're not hardcoding language associations
			if (!this.patternAppliesTo(file, patternId, context)) {
				continue;
			}

			// Apply the pattern to the content
			const matches = [...content.matchAll(regex)];
			for (const match of matches) {
				// Process based on pattern type
				if (type === 'import') {
					this.processImportMatch(match, file, confidence, context);
				} else if (type === 'export') {
					this.processExportMatch(match, file, confidence, context);
				}
			}
		}
	}

	/**
	 * Determine if a pattern applies to a file based on emergent evidence
	 */
	private patternAppliesTo(
		file: FileNode,
		patternId: string,
		_context: SharedAnalysisContext,
	): boolean {
		// We're not hardcoding language associations - instead we use evidence from the codebase
		const extension = file.extension.toLowerCase();

		// If no language is detected, try all patterns
		if (!file.languageType) {
			return true;
		}

		// If we've seen successful matches for this pattern on files with the same extension or language,
		// it's more likely to apply
		const patternLanguageState = this.patternLanguageMap?.get(patternId);
		if (patternLanguageState) {
			return (
				patternLanguageState.extensions.has(extension) ||
				patternLanguageState.languages.has(file.languageType)
			);
		}

		// On first pass, try all patterns
		return true;
	}

	/**
	 * Process an import pattern match
	 */
	private processImportMatch(
		match: RegExpMatchArray,
		file: FileNode,
		confidence: number,
		context: SharedAnalysisContext,
	): void {
		// Try to extract the module specifier
		const moduleSpecifier = this.extractModuleSpecifier(match[0]);
		if (!moduleSpecifier) return;

		// Create an import statement
		const importId = uuidv4();
		const lineNumber = this.getLineNumber(
			file.content as string,
			match.index || 0,
		);

		const importStmt: ImportStatement = {
			id: importId,
			moduleSpecifier,
			importedSymbols: [], // We'll skip detailed symbol extraction for emergent approach
			sourceFileId: file.path,
			sourceFilePath: file.path,
			line: lineNumber,
			dependencyType: this.inferDependencyType(
				moduleSpecifier,
				file.path,
				context,
			),
			confidence,
		};

		this.imports.push(importStmt);

		// Update dependency record
		this.updateDependency(moduleSpecifier, importStmt, file);

		// Record connection between files
		if (this.fileConnections.has(file.path)) {
			this.fileConnections.get(file.path)?.add(moduleSpecifier);
		} else {
			this.fileConnections.set(file.path, new Set([moduleSpecifier]));
		}

		// Update pattern language map for better future matching
		this.updatePatternLanguageMap(match, file);
	}

	/**
	 * Process an export pattern match
	 */
	private processExportMatch(
		match: RegExpMatchArray,
		file: FileNode,
		confidence: number,
		context: SharedAnalysisContext,
	): void {
		// For emergent analysis, we'll just record that something is exported
		// without trying to extract detailed symbol information

		const exportId = uuidv4();
		const lineNumber = this.getLineNumber(
			file.content as string,
			match.index || 0,
		);

		const exportStmt: ExportStatement = {
			id: exportId,
			exportedSymbols: [],
			sourceFileId: file.path,
			sourceFilePath: file.path,
			line: lineNumber,
			confidence,
		};

		this.exports.push(exportStmt);

		// Update file metadata to indicate it exports something
		file.metadata = file.metadata || {};
		file.metadata['hasExports'] = true;

		// Update pattern language map for better future matching
		this.updatePatternLanguageMap(match, file);
	}

	/**
	 * Extract a module specifier from a dependency statement
	 */
	private extractModuleSpecifier(statement: string): string | null {
		// Look for strings in quotes - the simplest and most language-agnostic approach
		const quotedMatch = /['"]([^'"]+)['"]/g.exec(statement);
		if (quotedMatch && quotedMatch[1]) {
			// Make sure it's not an empty string or contains spaces
			const candidate = quotedMatch[1].trim();
			if (candidate && !candidate.includes(' ')) {
				return candidate;
			}
		}

		// If no quoted path is found, look for bare words that might be module names
		// This is useful for languages like Python that don't use quotes for imports
		const bareWordMatch =
			/\b(?:import|from|require|use)\s+([a-zA-Z_][\w.]*)/g.exec(statement);
		if (bareWordMatch && bareWordMatch[1]) {
			return bareWordMatch[1];
		}

		return null;
	}

	/**
	 * Update dependency tracking information
	 */
	private updateDependency(
		moduleSpecifier: string,
		importStmt: ImportStatement,
		file: FileNode,
	): void {
		// Update or create the dependency record
		if (!this.dependencies.has(moduleSpecifier)) {
			// Create new dependency
			this.dependencies.set(moduleSpecifier, {
				id: uuidv4(),
				name: moduleSpecifier,
				type: importStmt.dependencyType,
				importCount: 1,
				importedSymbols: new Map(),
				importingFiles: new Set([file.path]),
				confidence: importStmt.confidence,
			});
		} else {
			// Update existing dependency
			const dep = this.dependencies.get(moduleSpecifier)!;
			dep.importCount++;
			dep.importingFiles.add(file.path);

			// Average the confidence
			dep.confidence = (dep.confidence + importStmt.confidence) / 2;
		}
	}

	/**
	 * Track pattern effectiveness by language and extension
	 */
	private updatePatternLanguageMap(
		match: RegExpMatchArray,
		file: FileNode,
	): void {
		// Initialize pattern language map if needed
		if (!this.patternLanguageMap) {
			this.patternLanguageMap = new Map<
				string,
				{
					extensions: Set<string>;
					languages: Set<string>;
				}
			>();
		}

		// Get pattern ID from regex toString
		const patternRegexStr = match[0];
		let patternId = '';

		for (const [id, pattern] of this.discoveredPatterns.entries()) {
			if (pattern.regex.test(patternRegexStr)) {
				patternId = id;
				break;
			}
		}

		if (!patternId) return;

		// Update pattern language map
		if (!this.patternLanguageMap.has(patternId)) {
			this.patternLanguageMap.set(patternId, {
				extensions: new Set<string>(),
				languages: new Set<string>(),
			});
		}

		const mapping = this.patternLanguageMap.get(patternId)!;
		mapping.extensions.add(file.extension.toLowerCase());
		if (file.languageType) {
			mapping.languages.add(file.languageType);
		}
	}

	/**
	 * Infer the dependency type without making language-specific assumptions
	 */
	private inferDependencyType(
		moduleSpecifier: string,
		sourceFilePath: string,
		context: SharedAnalysisContext,
	): DependencyType {
		// Check if it's a relative path (local file)
		if (
			moduleSpecifier.startsWith('./') ||
			moduleSpecifier.startsWith('../') ||
			moduleSpecifier.startsWith('/')
		) {
			return DependencyType.LOCAL_FILE;
		}

		// Check if it appears to be an internal module
		// This is a heuristic: if the module name matches a top-level directory in the project
		const rootDirs = context.fileSystem.root.children
			.filter(child => !('extension' in child))
			.map(child => child.name.toLowerCase());

		const topLevelName = moduleSpecifier.split('/')[0]?.toLowerCase();
		if (rootDirs.includes(topLevelName as string)) {
			return DependencyType.INTERNAL_MODULE;
		}

		// If we've seen this module name many times across the codebase,
		// it could be a standard library module
		const frequency = this.moduleNameFrequency.get(moduleSpecifier) || 0;
		if (
			frequency > 10 &&
			!moduleSpecifier.includes('@') &&
			!moduleSpecifier.includes('/')
		) {
			return DependencyType.STANDARD_LIBRARY;
		}

		// Default to external package
		return DependencyType.EXTERNAL_PACKAGE;
	}

	/**
	 * Enrich dependency understanding with relationship information
	 */
	private async enrichWithRelationships(
		context: SharedAnalysisContext,
	): Promise<void> {
		// Use existing relationships to help resolve dependencies
		const importRelationships = context.relationships.filter(
			rel => rel.type === RelationshipType.IMPORTS,
		);

		// Create a map of file paths to relationship targets
		const fileImportTargets = new Map<string, string[]>();

		for (const rel of importRelationships) {
			let sourcePath = '';
			let targetPath = '';

			// Extract source and target paths
			if (rel.sourceId.startsWith('file:')) {
				sourcePath = rel.sourceId.substring(5);
			}

			if (rel.targetId.startsWith('file:')) {
				targetPath = rel.targetId.substring(5);
			}

			if (!sourcePath || !targetPath) continue;

			// Record the relationship
			if (!fileImportTargets.has(sourcePath)) {
				fileImportTargets.set(sourcePath, []);
			}
			fileImportTargets.get(sourcePath)?.push(targetPath);
		}

		// Use relationship information to resolve import paths
		for (const importStmt of this.imports) {
			// Skip if already resolved or not a local file
			if (
				importStmt.resolvedPath ||
				importStmt.dependencyType !== DependencyType.LOCAL_FILE
			) {
				continue;
			}

			const {sourceFilePath, moduleSpecifier} = importStmt;

			// Check if we have relationship data for this file
			if (fileImportTargets.has(sourceFilePath)) {
				const targets = fileImportTargets.get(sourceFilePath) || [];

				// Try to find a matching target
				for (const targetPath of targets) {
					if (
						this.importMightTargetFile(
							moduleSpecifier,
							targetPath,
							context.fileSystem.root.path,
						)
					) {
						importStmt.resolvedPath = targetPath;
						importStmt.confidence = Math.min(importStmt.confidence, 0.8);
						break;
					}
				}
			}

			// If still not resolved, try to resolve by path manipulation
			if (!importStmt.resolvedPath) {
				importStmt.resolvedPath = this.resolveLocalImportPath(
					moduleSpecifier,
					sourceFilePath,
					context,
				);
			}
		}
	}

	/**
	 * Identify module structures in the codebase
	 */
	private async identifyModuleStructures(
		context: SharedAnalysisContext,
	): Promise<void> {
		// Analyze import/export patterns to identify module structures

		// 1. Identify central modules (imported by many files)
		const moduleImportCounts = new Map<string, number>();

		for (const dep of this.dependencies.values()) {
			moduleImportCounts.set(dep.name, dep.importCount);
		}

		// Get the top imported modules
		const centralModules = Array.from(moduleImportCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([name, count]) => ({name, count}));

		// 2. Identify module groups (modules that tend to be imported together)
		const moduleCooccurrence = new Map<string, Map<string, number>>();

		for (const [filePath, moduleSet] of this.fileConnections.entries()) {
			const modules = Array.from(moduleSet);

			// For each pair of modules imported by this file
			for (let i = 0; i < modules.length; i++) {
				for (let j = i + 1; j < modules.length; j++) {
					const modA = modules[i];
					const modB = modules[j];

					// Record co-occurrence
					if (!moduleCooccurrence.has(modA)) {
						moduleCooccurrence.set(modA, new Map());
					}
					const coocA = moduleCooccurrence.get(modA)!;
					coocA.set(modB, (coocA.get(modB) || 0) + 1);

					// Also record the reverse relationship
					if (!moduleCooccurrence.has(modB)) {
						moduleCooccurrence.set(modB, new Map());
					}
					const coocB = moduleCooccurrence.get(modB)!;
					coocB.set(modA, (coocB.get(modA) || 0) + 1);
				}
			}
		}

		// Find modules that frequently occur together
		const moduleGroups: Array<{modules: string[]; strength: number}> = [];

		for (const [modA, cooccurrences] of moduleCooccurrence.entries()) {
			// Find strong connections
			const strongConnections = Array.from(cooccurrences.entries())
				.filter(([_, count]) => count >= 3) // At least 3 co-occurrences
				.map(([modB, count]) => ({module: modB, count}))
				.sort((a, b) => b.count - a.count);

			if (strongConnections.length >= 2) {
				moduleGroups.push({
					modules: [modA, ...strongConnections.map(c => c.module)],
					strength:
						strongConnections.reduce((sum, c) => sum + c.count, 0) /
						strongConnections.length,
				});
			}
		}

		// Store module structure information
		this.moduleStructures = {
			centralModules,
			moduleGroups: moduleGroups.slice(0, 10), // Keep top 10 groups
		};
	}

	/**
	 * Find architectural patterns in dependency structure
	 */
	private findDependencyArchitecturalPatterns(
		context: SharedAnalysisContext,
	): Array<{
		name: string;
		description: string;
		confidence: number;
		metadata: any;
	}> {
		const patterns: Array<{
			name: string;
			description: string;
			confidence: number;
			metadata: any;
		}> = [];

		// If we found central modules, they might indicate architectural patterns
		if (this.moduleStructures?.centralModules.length) {
			const topModule = this.moduleStructures.centralModules[0];

			if (topModule.count > 5) {
				// If imported by many files
				patterns.push({
					name: 'Central module pattern',
					description: `The codebase has a central module "${topModule.name}" imported by ${topModule.count} files`,
					confidence: 0.7 + Math.min(0.2, topModule.count / 50), // Increase confidence with more imports
					metadata: {
						module: topModule.name,
						importCount: topModule.count,
					},
				});
			}
		}

		// Check for layered architecture pattern
		if (this.hasLayeredArchitecture(context)) {
			patterns.push({
				name: 'Layered architecture pattern',
				description:
					'The codebase shows evidence of a layered architecture with clear dependency direction',
				confidence: 0.75,
				metadata: {
					layers: this.identifiedLayers,
				},
			});
		}

		// Check for modular architecture
		if (this.moduleStructures?.moduleGroups.length) {
			// If we have distinct module groups with minimal overlap, it suggests a modular architecture
			const distinctGroups = this.moduleStructures.moduleGroups.filter(
				g => g.strength > 2,
			);

			if (distinctGroups.length >= 3) {
				patterns.push({
					name: 'Modular architecture pattern',
					description: `The codebase shows evidence of a modular architecture with ${distinctGroups.length} distinct module groups`,
					confidence: 0.7 + Math.min(0.2, distinctGroups.length / 10),
					metadata: {
						groupCount: distinctGroups.length,
						exampleGroups: distinctGroups
							.slice(0, 3)
							.map(g => g.modules.slice(0, 3)),
					},
				});
			}
		}

		return patterns;
	}

	/**
	 * Check if the codebase shows evidence of a layered architecture
	 */
	private hasLayeredArchitecture(context: SharedAnalysisContext): boolean {
		// Look for evidence of layers in directory structure and import patterns

		// 1. Check for common layer names in directory structure
		const potentialLayers = [
			'model',
			'view',
			'controller',
			'service',
			'repository',
			'data',
			'ui',
			'core',
		];
		const foundLayers: string[] = [];

		// Check root directories for layer names
		for (const child of context.fileSystem.root.children) {
			if (!('extension' in child)) {
				const dirName = child.name.toLowerCase();
				if (potentialLayers.includes(dirName)) {
					foundLayers.push(dirName);
				}
			}
		}

		// 2. Check for one-way dependencies between potential layers
		if (foundLayers.length >= 2) {
			// Check dependency direction between layers
			const layerDependencies = new Map<string, Set<string>>();

			// Initialize layer dependencies
			for (const layer of foundLayers) {
				layerDependencies.set(layer, new Set());
			}

			// Check imports between layers
			for (const importStmt of this.imports) {
				// Find layer of source file
				const sourceLayer = this.getLayerFromPath(
					importStmt.sourceFilePath,
					foundLayers,
				);

				// Find layer of target module (if resolved)
				let targetLayer: string | null = null;
				if (importStmt.resolvedPath) {
					targetLayer = this.getLayerFromPath(
						importStmt.resolvedPath,
						foundLayers,
					);
				}

				// Record dependency between layers
				if (sourceLayer && targetLayer && sourceLayer !== targetLayer) {
					layerDependencies.get(sourceLayer)?.add(targetLayer);
				}
			}

			// Check for mostly one-way dependencies (a key characteristic of layered architecture)
			const oneWayCount = this.countOneWayDependencies(layerDependencies);
			const totalPairs = (foundLayers.length * (foundLayers.length - 1)) / 2;

			// If most layer pairs have one-way dependencies, consider it a layered architecture
			if (oneWayCount > totalPairs * 0.6) {
				this.identifiedLayers = Array.from(layerDependencies.keys());
				return true;
			}
		}

		return false;
	}

	/**
	 * Count pairs of layers with one-way dependencies
	 */
	private countOneWayDependencies(
		layerDependencies: Map<string, Set<string>>,
	): number {
		let oneWayCount = 0;
		const layers = Array.from(layerDependencies.keys());

		for (let i = 0; i < layers.length; i++) {
			for (let j = i + 1; j < layers.length; j++) {
				const layerA = layers[i];
				const layerB = layers[j];

				const aDepB = layerDependencies.get(layerA)?.has(layerB) || false;
				const bDepA = layerDependencies.get(layerB)?.has(layerA) || false;

				// If dependency is one-way (not bidirectional)
				if ((aDepB && !bDepA) || (!aDepB && bDepA)) {
					oneWayCount++;
				}
			}
		}

		return oneWayCount;
	}

	/**
	 * Get the layer a file belongs to based on its path
	 */
	private getLayerFromPath(filePath: string, layers: string[]): string | null {
		for (const layer of layers) {
			if (filePath.includes(`/${layer}/`)) {
				return layer;
			}
		}
		return null;
	}

	/**
	 * Annotate files with dependency information
	 */
	private annotateFilesWithDependencyInfo(
		context: SharedAnalysisContext,
	): void {
		const annotateNode = (node: FileNode | DirectoryNode) => {
			if ('extension' in node) {
				// It's a file - check if it has dependencies
				const fileImports = this.imports.filter(
					imp => imp.sourceFilePath === node.path,
				);
				const fileExports = this.exports.filter(
					exp => exp.sourceFilePath === node.path,
				);

				if (fileImports.length > 0 || fileExports.length > 0) {
					// Update file metadata
					node.metadata = node.metadata || {};

					if (fileImports.length > 0) {
						node.metadata['imports'] = fileImports.map(imp => ({
							moduleSpecifier: imp.moduleSpecifier,
							type: imp.dependencyType,
							resolvedPath: imp.resolvedPath,
						}));
					}

					if (fileExports.length > 0) {
						node.metadata['exports'] = fileExports.length;
					}

					// Add more dependency metadata
					node.metadata['dependencyProfile'] = this.generateDependencyProfile(
						node,
						fileImports,
						fileExports,
					);
				}
			} else if ('children' in node) {
				// It's a directory - process children
				for (const child of node.children) {
					annotateNode(child);
				}
			}
		};

		annotateNode(context.fileSystem.root);
	}

	/**
	 * Generate a dependency profile for a file
	 */
	private generateDependencyProfile(
		file: FileNode,
		imports: ImportStatement[],
		exports: ExportStatement[],
	): any {
		// Skip if no dependencies
		if (imports.length === 0 && exports.length === 0) {
			return {};
		}

		// Count dependency types
		const depTypes: Record<string, number> = {};
		for (const imp of imports) {
			depTypes[imp.dependencyType] = (depTypes[imp.dependencyType] || 0) + 1;
		}

		// Find dominant dependency type
		let dominantType = '';
		let maxCount = 0;
		for (const [type, count] of Object.entries(depTypes)) {
			if (count > maxCount) {
				maxCount = count;
				dominantType = type;
			}
		}

		// Calculate import/export ratio
		const ratio =
			exports.length > 0 ? imports.length / exports.length : Infinity;

		// Determine file role based on dependencies
		let role = 'unknown';

		if (exports.length > 0 && imports.length === 0) {
			role = 'provider'; // Provides functionality without dependencies
		} else if (exports.length > 0 && imports.length > 0 && ratio < 2) {
			role = 'adapter'; // Transforms and exposes functionality
		} else if (imports.length > 3 && exports.length === 0) {
			role = 'consumer'; // Uses many dependencies without exporting
		} else if (imports.length > 0 && exports.length > 0 && ratio >= 2) {
			role = 'integrator'; // Brings together multiple dependencies
		}

		return {
			role,
			importCount: imports.length,
			exportCount: exports.length,
			dominantDependencyType: dominantType,
			dependencyTypeCounts: depTypes,
			importExportRatio: ratio,
		};
	}

	/**
	 * Create dependency relationships if they don't already exist
	 */
	private createDependencyRelationships(context: SharedAnalysisContext): void {
		// We'll create IMPORTS relationships for dependencies that don't already have them

		// First, build a map of existing relationships to avoid duplicates
		const existingRelationships = new Set<string>();

		for (const rel of context.relationships) {
			if (rel.type === RelationshipType.IMPORTS) {
				existingRelationships.add(`${rel.sourceId}:${rel.targetId}`);
			}
		}

		// Create new relationships for resolved imports
		const newRelationships: Array<{
			source: string;
			target: string;
			confidence: number;
		}> = [];

		for (const importStmt of this.imports) {
			// Skip imports without resolved paths
			if (!importStmt.resolvedPath) continue;

			const sourceId = `file:${importStmt.sourceFilePath}`;
			const targetId = `file:${importStmt.resolvedPath}`;

			// Skip if relationship already exists
			if (existingRelationships.has(`${sourceId}:${targetId}`)) {
				continue;
			}

			// Add to new relationships
			newRelationships.push({
				source: sourceId,
				target: targetId,
				confidence: importStmt.confidence,
			});
		}

		// Create relationships
		for (const {source, target, confidence} of newRelationships) {
			context.relationships.push({
				id: uuidv4(),
				type: RelationshipType.IMPORTS,
				sourceId: source,
				targetId: target,
				metadata: {
					discoveredBy: 'dependency-analyzer',
				},
				weight: 1.0,
				confidence,
			});
		}
	}

	/**
	 * Add module structure information to the context
	 */
	private addModuleStructureInfo(context: SharedAnalysisContext): void {
		if (!this.moduleStructures) return;

		// Add module structure information to file system metadata
		context.fileSystem.metadata.moduleStructure = {
			centralModules: this.moduleStructures.centralModules,
			moduleGroups: this.moduleStructures.moduleGroups.map(group => ({
				modules: group.modules.slice(0, 5), // Limit to 5 modules per group
				strength: group.strength,
			})),
		};

		// Add dependency type distribution
		const dependencyTypeDistribution: Record<string, number> = {};
		for (const dep of this.dependencies.values()) {
			dependencyTypeDistribution[dep.type] =
				(dependencyTypeDistribution[dep.type] || 0) + 1;
		}

		context.fileSystem.metadata.dependencyTypeDistribution =
			dependencyTypeDistribution;

		// If we identified layers, add that information
		if (this.identifiedLayers) {
			context.fileSystem.metadata.architecturalLayers = this.identifiedLayers;
		}
	}

	/**
	 * Check if an import statement might be targeting a specific file
	 */
	private importMightTargetFile(
		moduleSpecifier: string,
		targetPath: string,
		rootPath: string,
	): boolean {
		// Basic checks for filename matches
		const fileName = path.basename(targetPath);
		const fileNameWithoutExt = path.basename(
			targetPath,
			path.extname(targetPath),
		);

		// Direct name match
		if (moduleSpecifier === fileNameWithoutExt) return true;

		// Path-based matching
		const relativePath = path.relative(rootPath, targetPath);

		// Check for path similarity
		if (
			relativePath.includes(moduleSpecifier) ||
			moduleSpecifier.includes(relativePath)
		)
			return true;

		// Check for directory imports
		const moduleSpecifierDir = path.dirname(moduleSpecifier);
		if (
			moduleSpecifierDir !== '.' &&
			relativePath.startsWith(moduleSpecifierDir)
		)
			return true;

		return false;
	}

	/**
	 * Try to resolve a local import path
	 */
	private resolveLocalImportPath(
		moduleSpecifier: string,
		sourceFilePath: string,
		context: SharedAnalysisContext,
	): string | undefined {
		// Only try to resolve relative paths
		if (
			!moduleSpecifier.startsWith('./') &&
			!moduleSpecifier.startsWith('../')
		) {
			return undefined;
		}

		const rootDir = context.fileSystem.root.path;
		const sourceDirPath = path.dirname(sourceFilePath);

		// Resolve the module path relative to the source file
		let resolvedPath = path.resolve(sourceDirPath, moduleSpecifier);

		// Try direct match first
		const directMatch = this.findFileInTree(
			context.fileSystem.root,
			resolvedPath,
		);
		if (directMatch) {
			return directMatch.path;
		}

		// Try adding common extensions
		for (const ext of [
			'.js',
			'.jsx',
			'.ts',
			'.tsx',
			'.json',
			'.py',
			'.rb',
			'.php',
			'.java',
			'.c',
			'.cpp',
			'.h',
		]) {
			const pathWithExt = resolvedPath + ext;
			const match = this.findFileInTree(context.fileSystem.root, pathWithExt);
			if (match) {
				return match.path;
			}
		}

		// Try as directory with index file
		for (const indexFile of [
			'index.js',
			'index.jsx',
			'index.ts',
			'index.tsx',
			'__init__.py',
			'index.php',
		]) {
			const indexPath = path.join(resolvedPath, indexFile);
			const match = this.findFileInTree(context.fileSystem.root, indexPath);
			if (match) {
				return match.path;
			}
		}

		return undefined;
	}

	/**
	 * Find a file in the file system tree by path
	 */
	private findFileInTree(
		node: FileNode | DirectoryNode,
		targetPath: string,
	): FileNode | null {
		if ('extension' in node) {
			// It's a file
			if (node.path === targetPath) {
				return node;
			}
		} else if ('children' in node) {
			// It's a directory
			for (const child of node.children) {
				const result = this.findFileInTree(child, targetPath);
				if (result) {
					return result;
				}
			}
		}

		return null;
	}

	/**
	 * Get the line number for a position in text
	 */
	private getLineNumber(content: string, position: number): number {
		// Count newlines before the position
		const textBefore = content.substring(0, position);
		return (textBefore.match(/\n/g) || []).length + 1;
	}
}
