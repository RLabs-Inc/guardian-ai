/**
 * Language Detector Analyzer
 *
 * Discovers programming languages used in a codebase by observing patterns
 * and characteristics in the files themselves.
 * Following the emergent indexing principle of "Let the Code Speak".
 */

import path from 'path';
import {v4 as uuidv4} from 'uuid';
import {
	EmergentAnalyzer,
	FileNode,
	DirectoryNode,
	LanguageStructure,
	LanguageDetails,
	PatternDefinition,
} from '../unifiedTypes.js';

import {SharedAnalysisContext} from '../sharedAnalysisContext.js';

/**
 * Language detector analyzer for identifying programming languages in a codebase
 * following emergent indexing principles.
 */
export class LanguageDetectorAnalyzer implements EmergentAnalyzer {
	readonly id = 'language-detector';
	readonly name = 'Language Detector';
	readonly priority = 10; // High priority - runs first
	readonly dependencies: string[] = []; // No dependencies on other analyzers

	// Maps to store our discoveries during analysis
	private extensionMap = new Map<string, {count: number; files: FileNode[]}>();
	private contentSignatures = new Map<string, RegExp[]>();
	private directorySignatures = new Map<string, string[]>();
	private discoveredLanguages = new Map<string, Set<string>>();

	constructor() {
		// Initialize with an empty set of content signatures
		// We'll discover these during file analysis
		this.contentSignatures.clear();
		this.directorySignatures.clear();
		this.discoveredLanguages.clear();
	}

	/**
	 * Initialize method for EmergentAnalyzer interface
	 */
	async initialize(context: SharedAnalysisContext): Promise<void> {
		console.log(`[${this.name}] Initializing...`);

		// Register file header patterns that might help identify languages
		this.registerHeaderPatterns(context);

		// Reset our tracking maps
		this.extensionMap.clear();
		this.contentSignatures.clear();
		this.directorySignatures.clear();
		this.discoveredLanguages.clear();
	}

	/**
	 * Register common header patterns to aid in language detection
	 */
	private registerHeaderPatterns(context: SharedAnalysisContext): void {
		const patterns: PatternDefinition[] = [
			{
				type: 'file_header',
				name: 'Shebang Pattern',
				regex: '^#!.*?/(\\w+)(?:\\s|$)',
				description: 'Script interpreter indicator',
				confidence: 0.8,
			},
			{
				type: 'file_header',
				name: 'XML Declaration',
				regex: '^<\\?xml\\s+version=',
				description: 'XML declaration header',
				confidence: 0.9,
			},
			{
				type: 'file_header',
				name: 'HTML Doctype',
				regex: '<!DOCTYPE\\s+html',
				description: 'HTML doctype declaration',
				confidence: 0.9,
			},
			{
				type: 'file_header',
				name: 'PHP Opening Tag',
				regex: '<\\?php',
				description: 'PHP opening tag',
				confidence: 0.9,
			},
		];

		// Register the patterns
		for (const pattern of patterns) {
			context.registerPattern(pattern);
		}
	}

	/**
	 * Process a file during the content analysis phase
	 */
	async analyzeFile(
		file: FileNode,
		content: string,
		context: SharedAnalysisContext,
	): Promise<void> {
		// Add this file to our extension tracking
		const extension = path.extname(file.path).toLowerCase();
		if (extension) {
			if (!this.extensionMap.has(extension)) {
				this.extensionMap.set(extension, {count: 0, files: []});
			}
			const extInfo = this.extensionMap.get(extension)!;
			extInfo.count++;
			extInfo.files.push(file);
		}

		// Look for header patterns
		const headerPatterns = context.findMatchingPatterns(content, 'file_header');

		// Store any header info in file metadata
		if (headerPatterns.length > 0) {
			file.metadata = file.metadata || {};
			file.metadata['headerPatterns'] = headerPatterns.map(pattern => ({
				name: pattern.patternId,
				match: pattern.match,
				confidence: pattern.confidence,
			}));
		}

		// Extract and store content signatures that might help identify the language
		this.extractContentSignatures(file, content, extension);

		// Track directory name correlations for future analysis
		this.trackDirectoryCorrelation(file);
	}

	/**
	 * Extract content signatures that might be helpful for language identification
	 */
	private extractContentSignatures(
		file: FileNode,
		content: string,
		extension: string,
	): void {
		// Don't analyze very large files
		if (content.length > 500000) return;

		// Store the dominant content patterns in this file
		const patterns: RegExp[] = [];

		// Check for key language features (we're building evidence, not assuming languages)
		// These patterns can appear in many languages - we're just collecting signatures

		// Object-oriented features
		if (/\b(class|interface|extends|implements|prototype)\b/i.test(content)) {
			patterns.push(/\b(class|interface|extends|implements|prototype)\b/i);

			file.metadata = file.metadata || {};
			file.metadata['paradigmEvidence'] =
				file.metadata['paradigmEvidence'] || [];
			file.metadata['paradigmEvidence'].push('object-oriented');
		}

		// Functional programming features
		if (/\b(function|lambda|=>|->|map|filter|reduce)\b/i.test(content)) {
			patterns.push(/\b(function|lambda|=>|->|map|filter|reduce)\b/i);

			file.metadata = file.metadata || {};
			file.metadata['paradigmEvidence'] =
				file.metadata['paradigmEvidence'] || [];
			file.metadata['paradigmEvidence'].push('functional');
		}

		// Imports/includes
		if (/\b(import|require|include|using|from)\b/i.test(content)) {
			patterns.push(/\b(import|require|include|using|from)\b/i);

			// Extract the import pattern for future analysis
			const importLines: string[] = [];
			const lines = content.split('\n');
			for (const line of lines) {
				if (/\b(import|require|include|using|from)\b/i.test(line)) {
					importLines.push(line.trim());
				}
			}

			file.metadata = file.metadata || {};
			file.metadata['importPatterns'] = importLines.slice(0, 5); // Store up to 5 examples
		}

		// Store discovered patterns with the extension
		if (extension && patterns.length > 0) {
			if (!this.contentSignatures.has(extension)) {
				this.contentSignatures.set(extension, []);
			}
			this.contentSignatures.get(extension)!.push(...patterns);
		}
	}

	/**
	 * Track correlations between directories and file extensions
	 */
	private trackDirectoryCorrelation(file: FileNode): void {
		const extension = path.extname(file.path).toLowerCase();
		if (!extension) return;

		const dirPath = path.dirname(file.path);
		const dirName = path.basename(dirPath).toLowerCase();

		// Skip very common directory names
		if (['src', 'source', 'app', 'lib'].includes(dirName)) return;

		// Add this directory name to possible signatures for this extension
		if (!this.directorySignatures.has(extension)) {
			this.directorySignatures.set(extension, []);
		}

		const signatures = this.directorySignatures.get(extension)!;
		if (!signatures.includes(dirName)) {
			signatures.push(dirName);
		}
	}

	/**
	 * Process relationships - required by EmergentAnalyzer interface
	 */
	async processRelationships(context: SharedAnalysisContext): Promise<void> {
		// For language detection, relationships aren't critical
		console.log(`[${this.name}] Processing language relationship patterns...`);
	}

	/**
	 * Discover patterns specific to each detected language
	 */
	async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
		console.log(`[${this.name}] Discovering language-specific patterns...`);

		// First, identify common patterns in each language
		for (const [lang, details] of context.languages.languages.entries()) {
			await this.discoverLanguagePatterns(context, lang, details);
		}
	}

	/**
	 * Discover patterns specific to a language
	 */
	private async discoverLanguagePatterns(
		context: SharedAnalysisContext,
		languageName: string,
		details: LanguageDetails,
	): Promise<void> {
		// Collect files for this language
		const files: FileNode[] = [];
		for (const filePath of details.paths) {
			const file = details.filesByPath[filePath];
			if (file) files.push(file);
		}

		// Skip if very few files
		if (files.length < 3) return;

		// Sample a subset of files for pattern discovery
		const sampleSize = Math.min(files.length, 50);
		const sampleFiles = this.getRandomSample(files, sampleSize);

		// Discover import patterns
		await this.discoverImportPatterns(
			context,
			languageName,
			details.extensions,
			sampleFiles,
		);

		// Discover dominant paradigms and register language construct patterns
		await this.discoverParadigmPatterns(
			context,
			languageName,
			details.extensions,
			sampleFiles,
		);
	}

	/**
	 * Get a random sample of items
	 */
	private getRandomSample<T>(items: T[], size: number): T[] {
		const shuffled = [...items].sort(() => 0.5 - Math.random());
		return shuffled.slice(0, size);
	}

	/**
	 * Discover import patterns for a language
	 */
	private async discoverImportPatterns(
		context: SharedAnalysisContext,
		languageName: string,
		extensions: string[],
		sampleFiles: FileNode[],
	): Promise<void> {
		// Collect import pattern examples from files
		const importExamples: string[] = [];

		for (const file of sampleFiles) {
			const examples = (file.metadata['importPatterns'] as string[]) || [];
			importExamples.push(...examples);
		}

		// Skip if too few examples
		if (importExamples.length < 3) return;

		// Find common patterns
		const patterns = this.extractCommonPatterns(importExamples);

		// Register the discovered patterns
		for (const [pattern, frequency] of patterns) {
			// Only register if it appears in at least 20% of examples
			if (frequency < importExamples.length * 0.2) continue;

			const patternId = uuidv4();
			context.registerPattern({
				id: patternId,
				type: 'import_pattern',
				name: `${languageName} Import Pattern`,
				regex: pattern,
				description: `Auto-discovered import pattern for ${languageName}`,
				confidence: Math.min(
					0.9,
					0.6 + (frequency / importExamples.length) * 0.3,
				),
				metadata: {
					language: languageName,
					extensions: extensions.join(','),
				},
			});
		}
	}

	/**
	 * Extract common patterns from examples
	 */
	private extractCommonPatterns(examples: string[]): [string, number][] {
		// Extract patterns based on word frequency and position
		const patterns: Map<string, number> = new Map();

		// First, collect first words of lines
		const firstWords = examples
			.map(ex => {
				const words = ex.trim().split(/\s+/);
				return words.length > 0 ? words[0] : '';
			})
			.filter(w => w.length > 0);

		// Count first words
		const firstWordCounts = new Map<string, number>();
		for (const word of firstWords) {
			firstWordCounts.set(
				word || '',
				(firstWordCounts.get(word || '') || 0) + 1,
			);
		}

		// For frequent first words, build regex patterns
		for (const [word, count] of firstWordCounts.entries()) {
			if (count >= 2) {
				// Need at least 2 occurrences
				// Find examples starting with this word
				const matchingExamples = examples.filter(ex =>
					ex.trim().startsWith(word),
				);

				// Extract common pattern elements
				const hasFrom = matchingExamples.some(ex => /\bfrom\b/.test(ex));
				const hasQuotes = matchingExamples.some(ex => /['"]/.test(ex));
				const hasBraces = matchingExamples.some(ex => /{/.test(ex));

				// Construct a pattern
				let pattern = `\\b${word}\\b`;

				if (hasBraces) {
					pattern += '(?:\\s*{[^}]*})?';
				}

				if (hasFrom) {
					pattern += '(?:\\s+[^;]*?\\bfrom\\b)?';
				}

				if (hasQuotes) {
					pattern += '(?:\\s+[\'"][^\'"]*[\'"])?';
				}

				// Store pattern with its frequency
				patterns.set(pattern, count);
			}
		}

		return Array.from(patterns.entries());
	}

	/**
	 * Discover paradigm patterns for a language
	 */
	private async discoverParadigmPatterns(
		context: SharedAnalysisContext,
		languageName: string,
		extensions: string[],
		sampleFiles: FileNode[],
	): Promise<void> {
		// Count paradigm evidence
		const paradigmCounts: Record<string, number> = {};

		for (const file of sampleFiles) {
			const evidence = (file.metadata['paradigmEvidence'] as string[]) || [];
			for (const paradigm of evidence) {
				paradigmCounts[paradigm] = (paradigmCounts[paradigm] || 0) + 1;
			}
		}

		// Sort paradigms by frequency
		const sortedParadigms = Object.entries(paradigmCounts)
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({
				name,
				count,
				frequency: count / sampleFiles.length,
			}));

		// Register patterns for the dominant paradigms
		for (const paradigm of sortedParadigms.slice(0, 2)) {
			// Take top 2 paradigms
			// Skip if not common enough
			if (paradigm.frequency < 0.3) continue;

			let patternRegex = '';
			let patternName = '';

			switch (paradigm.name) {
				case 'object-oriented':
					patternRegex =
						'\\b(class|interface)\\s+(\\w+)(?:\\s+(?:extends|implements)\\s+([\\w,\\s]+))?\\s*{';
					patternName = 'Class Definition';
					break;
				case 'functional':
					patternRegex =
						'\\b(?:function|const)\\s+(\\w+)\\s*(?:=\\s*)?\\([^)]*\\)\\s*(?:=>)?\\s*[{:]';
					patternName = 'Function Definition';
					break;
				default:
					continue;
			}

			const patternId = uuidv4();
			context.registerPattern({
				id: patternId,
				type: 'language_construct',
				name: `${languageName} ${patternName}`,
				regex: patternRegex,
				description: `Auto-discovered ${patternName.toLowerCase()} pattern for ${languageName}`,
				confidence: Math.min(0.9, 0.6 + paradigm.frequency * 0.3),
				metadata: {
					language: languageName,
					paradigm: paradigm.name,
				},
			});
		}
	}

	/**
	 * Integrate analysis into the shared context
	 */
	async integrateAnalysis(context: SharedAnalysisContext): Promise<void> {
		console.log(`[${this.name}] Integrating language analysis...`);

		// Determine language paradigms based on collected evidence
		const paradigmsByLanguage = this.determineLanguageParadigms(context);

		// Update the language details with paradigm information
		for (const [lang, details] of context.languages.languages.entries()) {
			if (paradigmsByLanguage[lang]) {
				details.dominantParadigms = paradigmsByLanguage[lang];
			}
		}

		// Record metrics
		context.recordMetric('language_count', context.languages.languages.size);
		context.recordMetric(
			'dominant_language_file_count',
			this.countFilesForLanguage(context, context.languages.dominant),
		);
	}

	/**
	 * Determine language paradigms based on file evidence
	 */
	private determineLanguageParadigms(
		context: SharedAnalysisContext,
	): Record<string, string[]> {
		const paradigmsByLanguage: Record<string, string[]> = {};

		for (const [lang, details] of context.languages.languages.entries()) {
			// Collect all evidence for this language
			const paradigmCounts: Record<string, number> = {};

			// Process files to count paradigm evidence
			for (const filePath of details.paths) {
				const file = details.filesByPath[filePath];
				if (!file) continue;

				const evidence = (file.metadata['paradigmEvidence'] as string[]) || [];
				for (const paradigm of evidence) {
					paradigmCounts[paradigm] = (paradigmCounts[paradigm] || 0) + 1;
				}
			}

			// Sort paradigms by frequency
			const sortedParadigms = Object.entries(paradigmCounts)
				.sort((a, b) => b[1] - a[1])
				.map(([name]) => name);

			// Use top paradigms, or fallback to a general one if none found
			paradigmsByLanguage[lang] =
				sortedParadigms.length > 0
					? sortedParadigms.slice(0, 3) // Top 3 paradigms
					: ['general-purpose']; // Fallback
		}

		return paradigmsByLanguage;
	}

	/**
	 * Count files for a specific language
	 */
	private countFilesForLanguage(
		context: SharedAnalysisContext,
		language: string,
	): number {
		const langDetails = context.languages.languages.get(language);
		return langDetails ? langDetails.fileCount : 0;
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// Reset our internal tracking maps
		this.extensionMap.clear();
		this.contentSignatures.clear();
		this.directorySignatures.clear();
		this.discoveredLanguages.clear();
	}

	/**
	 * Specialized method for language detection
	 * Called directly by the coordinator
	 */
	async detectLanguages(context: SharedAnalysisContext): Promise<void> {
		console.log(`[${this.name}] Detecting languages in the codebase...`);

		// Get all files from the file system
		const files = this.getAllFiles(context.fileSystem.root);

		// Group files by extension
		for (const file of files) {
			const extension = path.extname(file.path).toLowerCase();

			// Skip files without extensions
			if (!extension) continue;

			// Add to extension map
			if (!this.extensionMap.has(extension)) {
				this.extensionMap.set(extension, {count: 0, files: []});
			}

			const extInfo = this.extensionMap.get(extension)!;
			extInfo.count++;
			extInfo.files.push(file);
		}

		// Group related extensions into languages
		const languageGroups = this.identifyLanguageGroups();

		// Create language structure
		const languageMap = new Map<string, LanguageDetails>();
		const paradigmCounts: Record<string, number> = {};

		// For each language group, create a language details object
		for (const [languageName, groupInfo] of languageGroups) {
			// Create language details
			languageMap.set(languageName, {
				name: languageName,
				extensions: groupInfo.extensions,
				paths: [],
				fileCount: 0,
				totalSize: 0,
				dominantParadigms: ['unknown'], // Will be updated later
				filesByPath: {},
			});

			// Add files to the language
			const langDetails = languageMap.get(languageName)!;

			for (const file of groupInfo.files) {
				// Add file to language details
				langDetails.paths.push(file.path);
				langDetails.fileCount++;
				langDetails.totalSize += file.size;
				langDetails.filesByPath[file.path] = file;

				// Set the language type on the file node
				file.languageType = languageName;
				file.metadata = file.metadata || {};
				file.metadata['languageDetectionMethod'] = 'extension_analysis';
			}
		}

		// Determine dominant language
		let dominantLanguage = '';
		let maxFiles = 0;

		for (const [lang, details] of languageMap.entries()) {
			if (details.fileCount > maxFiles) {
				maxFiles = details.fileCount;
				dominantLanguage = lang;
			}
		}

		// Store language structure in context
		context.languages = {
			languages: languageMap,
			dominant: dominantLanguage,
			paradigms: paradigmCounts,
		};

		// Analyze directory structures for additional insights
		await this.analyzeDirectoryStructure(context);

		console.log(
			`[${this.name}] Detected ${languageMap.size} languages. Dominant: ${dominantLanguage}`,
		);
	}

	/**
	 * Identify language groups based on extensions and other evidence
	 */
	private identifyLanguageGroups(): Map<
		string,
		{extensions: string[]; files: FileNode[]}
	> {
		const groups = new Map<string, {extensions: string[]; files: FileNode[]}>();
		const processedExtensions = new Set<string>();

		// First, handle common known extensions
		const knownExtensions: Record<string, string> = {
			'.js': 'JavaScript',
			'.jsx': 'JavaScript',
			'.ts': 'TypeScript',
			'.tsx': 'TypeScript',
			'.py': 'Python',
			'.java': 'Java',
			'.html': 'HTML',
			'.css': 'CSS',
			'.scss': 'CSS',
			'.json': 'JSON',
			'.md': 'Markdown',
			'.c': 'C',
			'.cpp': 'C++',
			'.h': 'C',
			'.hpp': 'C++',
			'.rb': 'Ruby',
			'.go': 'Go',
			'.rs': 'Rust',
			'.php': 'PHP',
			'.sql': 'SQL',
			'.sh': 'Shell',
			'.yml': 'YAML',
			'.yaml': 'YAML',
			'.xml': 'XML',
		};

		// Group known extensions first
		for (const [ext, langName] of Object.entries(knownExtensions)) {
			if (this.extensionMap.has(ext) && !processedExtensions.has(ext)) {
				processedExtensions.add(ext);

				// Find related extensions that should belong to the same language
				const relatedExts: string[] = [];

				for (const [otherExt, _] of this.extensionMap.entries()) {
					// Skip self or already processed
					if (otherExt === ext || processedExtensions.has(otherExt)) continue;

					// Check for known related extensions
					if (this.areExtensionsRelated(ext, otherExt)) {
						relatedExts.push(otherExt);
						processedExtensions.add(otherExt);
					}
				}

				// Create language group
				const allFiles: FileNode[] = [];
				const extInfo = this.extensionMap.get(ext);
				if (extInfo) {
					allFiles.push(...extInfo.files);
				}

				// Add files from related extensions
				for (const relExt of relatedExts) {
					const relExtInfo = this.extensionMap.get(relExt);
					if (relExtInfo) {
						allFiles.push(...relExtInfo.files);
					}
				}

				// Only add the group if we have files
				if (allFiles.length > 0) {
					groups.set(langName, {
						extensions: [ext, ...relatedExts],
						files: allFiles,
					});
				}
			}
		}

		// Now process remaining unknown extensions
		for (const [ext, extInfo] of this.extensionMap.entries()) {
			if (!processedExtensions.has(ext)) {
				processedExtensions.add(ext);

				// Infer language name from extension
				const langName = this.inferLanguageNameFromExtension(ext);

				// Find any related extensions
				const relatedExts: string[] = [];

				for (const [otherExt, _] of this.extensionMap.entries()) {
					if (otherExt === ext || processedExtensions.has(otherExt)) continue;

					// Check if they might be related
					if (this.areExtensionsRelated(ext, otherExt)) {
						relatedExts.push(otherExt);
						processedExtensions.add(otherExt);
					}
				}

				// Create language group
				groups.set(langName, {
					extensions: [ext, ...relatedExts],
					files: extInfo.files,
				});
			}
		}

		return groups;
	}

	/**
	 * Check if two extensions are related
	 */
	private areExtensionsRelated(ext1: string, ext2: string): boolean {
		// Common related extension patterns
		const knownRelationships: [string, string][] = [
			['.js', '.jsx'],
			['.ts', '.tsx'],
			['.css', '.scss'],
			['.css', '.less'],
			['.c', '.h'],
			['.cpp', '.hpp'],
			['.cc', '.hh'],
			['.yaml', '.yml'],
		];

		// Check known relationships
		for (const [a, b] of knownRelationships) {
			if ((ext1 === a && ext2 === b) || (ext1 === b && ext2 === a)) {
				return true;
			}
		}

		// Extract base parts of extensions
		const base1 = ext1.replace(/^\./, '');
		const base2 = ext2.replace(/^\./, '');

		// Check if one is a prefix of the other (e.g., .ts and .tsx)
		if (base1.startsWith(base2) || base2.startsWith(base1)) {
			return true;
		}

		// Check if they share directory signatures
		const dirs1 = this.directorySignatures.get(ext1) || [];
		const dirs2 = this.directorySignatures.get(ext2) || [];

		// Check for directory overlap
		const commonDirs = dirs1.filter(d => dirs2.includes(d));
		if (commonDirs.length > 0) {
			return true;
		}

		return false;
	}

	/**
	 * Infer a language name from an extension
	 */
	private inferLanguageNameFromExtension(ext: string): string {
		// Remove the dot and capitalize
		const base = ext.replace(/^\./, '');
		return base.charAt(0).toUpperCase() + base.slice(1);
	}

	/**
	 * Analyze directory structure for language information
	 */
	private async analyzeDirectoryStructure(
		context: SharedAnalysisContext,
	): Promise<void> {
		// Get all directories
		const directories = this.getDirectories(context.fileSystem.root);

		// For each directory, calculate language distribution
		for (const dir of directories) {
			const langCounts: Record<string, number> = {};

			// Process direct file children
			for (const child of dir.children) {
				if ('extension' in child && child.languageType) {
					langCounts[child.languageType] =
						(langCounts[child.languageType] || 0) + 1;
				}
			}

			// Find dominant language
			let dominantLang = '';
			let maxCount = 0;

			for (const [lang, count] of Object.entries(langCounts)) {
				if (count > maxCount) {
					maxCount = count;
					dominantLang = lang;
				}
			}

			// If we found a dominant language, store it
			if (dominantLang) {
				dir.metadata = dir.metadata || {};
				dir.metadata['dominantLanguage'] = dominantLang;
				dir.metadata['languageCounts'] = langCounts;

				// Also add this directory to the language details
				const langDetails = context.languages.languages.get(dominantLang);
				if (langDetails) {
					langDetails.metadata = langDetails.metadata || {};
					langDetails.metadata.dominantDirectories =
						langDetails.metadata.dominantDirectories || [];
					langDetails.metadata.dominantDirectories.push(dir.path);
				}
			}
		}
	}

	/**
	 * Get all files from the file system
	 */
	private getAllFiles(node: DirectoryNode | FileNode): FileNode[] {
		const files: FileNode[] = [];

		if ('extension' in node) {
			// This is a file node
			files.push(node);
		} else if ('children' in node && node.children) {
			// This is a directory node with children
			for (const child of node.children) {
				files.push(...this.getAllFiles(child));
			}
		}

		return files;
	}

	/**
	 * Get all directories from the file system
	 */
	private getDirectories(node: DirectoryNode): DirectoryNode[] {
		const dirs: DirectoryNode[] = [];

		// Add this directory
		dirs.push(node);

		// Process children
		if ('children' in node && node.children) {
			for (const child of node.children) {
				if (!('extension' in child) && 'children' in child) {
					dirs.push(...this.getDirectories(child));
				}
			}
		}

		return dirs;
	}
}
