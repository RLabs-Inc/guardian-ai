// source/services/indexing/llmDirected/storagePrimitives.ts

import * as path from 'path';
import {FileSystemService} from '../../fileSystem/types.js';
import {CodeSymbol, CodeDependency} from '../types.js';

/**
 * This class provides storage primitives that can be used by the LLM agent to analyze and store code
 * These primitives are designed to be flexible tools that the LLM can use based on its indexing strategy
 */
export class StoragePrimitives {
	private fileSystem: FileSystemService;
	private projectRoot: string;
	private symbols: Map<string, CodeSymbol> = new Map();
	private dependencies: CodeDependency[] = [];
	private chunks: Map<
		string,
		Array<{content: string; startLine: number; endLine: number; type?: string}>
	> = new Map();
	private fileContents: Map<string, string> = new Map();

	constructor(fileSystem: FileSystemService, projectRoot: string) {
		this.fileSystem = fileSystem;
		this.projectRoot = projectRoot;
	}

	/**
	 * Clears the cached content for a file to free memory
	 */
	clearFileContent(filePath: string): void {
		const relativePath = path.isAbsolute(filePath)
			? path.relative(this.projectRoot, filePath)
			: filePath;

		if (this.fileContents.has(relativePath)) {
			this.fileContents.delete(relativePath);
		}
	}

	/**
	 * Clears the cached chunks for a file to free memory
	 */
	clearFileChunks(filePath: string): void {
		const relativePath = path.isAbsolute(filePath)
			? path.relative(this.projectRoot, filePath)
			: filePath;

		if (this.chunks.has(relativePath)) {
			this.chunks.delete(relativePath);
		}
	}

	// --- FILE PROCESSING PRIMITIVES ---

	/**
	 * Reads a file and returns its content
	 */
	async readFile(filePath: string): Promise<string> {
		try {
			const fullPath = path.isAbsolute(filePath)
				? filePath
				: path.join(this.projectRoot, filePath);
			const fileContent = await this.fileSystem.readFile(fullPath);

			// Cache the content for later use
			const relativePath = path.relative(this.projectRoot, fullPath);
			this.fileContents.set(relativePath, fileContent.content);

			return fileContent.content;
		} catch (error) {
			console.error(`Error reading file ${filePath}:`, error);
			throw new Error(`Failed to read file: ${filePath}`);
		}
	}

	/**
	 * Gets basic info about a file
	 */
	async getFileInfo(filePath: string): Promise<{
		extension: string;
		size: number;
		lastModified: Date;
		lineCount: number;
	}> {
		try {
			const fullPath = path.isAbsolute(filePath)
				? filePath
				: path.join(this.projectRoot, filePath);
			const fileContent = await this.fileSystem.readFile(fullPath);

			return {
				extension: path.extname(filePath),
				size: fileContent.info.size,
				lastModified: fileContent.info.modified,
				lineCount: fileContent.content.split('\n').length,
			};
		} catch (error) {
			console.error(`Error getting file info for ${filePath}:`, error);
			throw new Error(`Failed to get file info: ${filePath}`);
		}
	}

	/**
	 * Gets the first N lines of a file (useful for quick analysis)
	 */
	async getFileSample(filePath: string, lines: number = 20): Promise<string> {
		try {
			const content =
				this.fileContents.get(filePath) || (await this.readFile(filePath));
			const allLines = content.split('\n');
			return allLines.slice(0, Math.min(lines, allLines.length)).join('\n');
		} catch (error) {
			console.error(`Error getting file sample for ${filePath}:`, error);
			throw new Error(`Failed to get file sample: ${filePath}`);
		}
	}

	// --- CHUNKING PRIMITIVES ---

	/**
	 * Chunks a file by a specific delimiter
	 */
	async chunkByDelimiter(
		filePath: string,
		startDelimiter: string | RegExp,
		endDelimiter: string | RegExp,
		type?: string,
	): Promise<
		Array<{content: string; startLine: number; endLine: number; type?: string}>
	> {
		try {
			const content =
				this.fileContents.get(filePath) || (await this.readFile(filePath));
			const lines = content.split('\n');
			const chunks: Array<{
				content: string;
				startLine: number;
				endLine: number;
				type?: string;
			}> = [];

			let inChunk = false;
			let chunkStartLine = 0;
			let currentChunk: string[] = [];

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] || '';

				if (!inChunk) {
					// Look for start delimiter
					if (
						typeof startDelimiter === 'string'
							? line.includes(startDelimiter)
							: startDelimiter.test(line)
					) {
						inChunk = true;
						chunkStartLine = i + 1; // 1-indexed line numbers
						currentChunk = [line];
					}
				} else {
					// Already in a chunk, add the line
					currentChunk.push(line);

					// Look for end delimiter
					if (
						typeof endDelimiter === 'string'
							? line.includes(endDelimiter)
							: endDelimiter.test(line)
					) {
						inChunk = false;
						chunks.push({
							content: currentChunk.join('\n'),
							startLine: chunkStartLine,
							endLine: i + 1, // 1-indexed line numbers
							type,
						});
						currentChunk = [];
					}
				}
			}

			// Store chunks for this file
			this.chunks.set(filePath, chunks);

			return chunks;
		} catch (error) {
			console.error(`Error chunking file ${filePath} by delimiter:`, error);
			throw new Error(`Failed to chunk file by delimiter: ${filePath}`);
		}
	}

	/**
	 * Chunks a file by fixed line count
	 */
	async chunkByLineCount(
		filePath: string,
		linesPerChunk: number,
		overlap: number = 0,
		type?: string,
	): Promise<
		Array<{content: string; startLine: number; endLine: number; type?: string}>
	> {
		try {
			const content =
				this.fileContents.get(filePath) || (await this.readFile(filePath));
			const lines = content.split('\n');
			const chunks: Array<{
				content: string;
				startLine: number;
				endLine: number;
				type?: string;
			}> = [];

			for (let i = 0; i < lines.length; i += linesPerChunk - overlap) {
				if (i + linesPerChunk > lines.length && i > 0) break; // Skip incomplete chunk at end

				const endIdx = Math.min(i + linesPerChunk, lines.length);
				chunks.push({
					content: lines.slice(i, endIdx).join('\n'),
					startLine: i + 1, // 1-indexed line numbers
					endLine: endIdx,
					type,
				});
			}

			// Store chunks for this file
			this.chunks.set(filePath, chunks);

			return chunks;
		} catch (error) {
			console.error(`Error chunking file ${filePath} by line count:`, error);
			throw new Error(`Failed to chunk file by line count: ${filePath}`);
		}
	}

	/**
	 * Chunks a file by semantic patterns (like function declarations, class definitions, etc.)
	 */
	async chunkByPattern(
		filePath: string,
		patterns: Array<{pattern: string | RegExp; type: string}>,
	): Promise<
		Array<{content: string; startLine: number; endLine: number; type: string}>
	> {
		try {
			const content =
				this.fileContents.get(filePath) || (await this.readFile(filePath));
			const lines = content.split('\n');
			const chunks: Array<{
				content: string;
				startLine: number;
				endLine: number;
				type: string;
			}> = [];

			for (const {pattern, type} of patterns) {
				let patternRegExp: RegExp;

				if (typeof pattern === 'string') {
					// Escape special regex characters in the string
					const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					patternRegExp = new RegExp(escapedPattern);
				} else {
					patternRegExp = pattern;
				}

				// Find all matches
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i] || '';

					if (patternRegExp.test(line)) {
						// Found a match, determine chunk boundaries
						// This is a simplified approach - a more sophisticated approach would
						// analyze the code structure to find the proper end of the block

						let endLine = i + 1;
						let braceCount = 0;
						let foundOpenBrace = false;

						// Simplified approach: look for matching braces to find end of chunk
						for (let j = i; j < lines.length; j++) {
							const currentLine = lines[j] || '';

							// Count open braces
							const openBraces = (currentLine.match(/\{/g) || []).length;
							// Count close braces
							const closeBraces = (currentLine.match(/\}/g) || []).length;

							if (openBraces > 0) foundOpenBrace = true;

							braceCount += openBraces - closeBraces;

							// If we found the matching closing brace, we've reached the end of the chunk
							if (foundOpenBrace && braceCount === 0) {
								endLine = j + 1;
								break;
							}
						}

						chunks.push({
							content: lines.slice(i, endLine).join('\n'),
							startLine: i + 1, // 1-indexed line numbers
							endLine: endLine,
							type,
						});

						// Skip to the end of this chunk to avoid overlapping chunks
						i = endLine - 1;
					}
				}
			}

			// Sort chunks by start line
			chunks.sort((a, b) => a.startLine - b.startLine);

			// Store chunks for this file
			this.chunks.set(filePath, chunks);

			return chunks;
		} catch (error) {
			console.error(`Error chunking file ${filePath} by pattern:`, error);
			throw new Error(`Failed to chunk file by pattern: ${filePath}`);
		}
	}

	// --- ANALYSIS PRIMITIVES ---

	/**
	 * Count occurrences of patterns in a file
	 */
	async countPatterns(
		filePath: string,
		patterns: Array<{pattern: string | RegExp; name: string}>,
	): Promise<Record<string, number>> {
		try {
			const content =
				this.fileContents.get(filePath) || (await this.readFile(filePath));
			const counts: Record<string, number> = {};

			for (const {pattern, name} of patterns) {
				if (typeof pattern === 'string') {
					// Count simple string occurrences
					const regex = new RegExp(
						pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
						'g',
					);
					const matches = content.match(regex);
					counts[name] = matches ? matches.length : 0;
				} else {
					// Count regex matches
					const matches = content.match(pattern);
					counts[name] = matches ? matches.length : 0;
				}
			}

			return counts;
		} catch (error) {
			console.error(`Error counting patterns in ${filePath}:`, error);
			throw new Error(`Failed to count patterns: ${filePath}`);
		}
	}

	/**
	 * Identify language-specific features in a file
	 */
	async identifyFeatures(
		filePath: string,
		extension: string,
	): Promise<string[]> {
		try {
			const content =
				this.fileContents.get(filePath) || (await this.readFile(filePath));
			const features: string[] = [];

			// This is a simplified implementation - a real one would be more sophisticated
			// and would vary based on the language

			// JavaScript/TypeScript features
			if (
				extension === '.js' ||
				extension === '.ts' ||
				extension === '.jsx' ||
				extension === '.tsx'
			) {
				if (content.includes('class ')) features.push('classes');
				if (content.includes('function ')) features.push('functions');
				if (content.includes('=>')) features.push('arrow-functions');
				if (content.includes('async ')) features.push('async-await');
				if (content.includes('import ')) features.push('es-modules');
				if (content.includes('require(')) features.push('commonjs-modules');
				if (content.includes('export ')) features.push('exports');
				if (content.includes('interface '))
					features.push('typescript-interfaces');
				if (content.includes('type ')) features.push('typescript-types');
				if (content.includes('React')) features.push('react');
				if (content.includes('useState')) features.push('react-hooks');
				if (content.includes('<')) features.push('jsx');
			}

			// Python features
			else if (extension === '.py') {
				if (content.includes('class ')) features.push('classes');
				if (content.includes('def ')) features.push('functions');
				if (content.includes('async def')) features.push('async-functions');
				if (content.includes('import ')) features.push('imports');
				if (content.includes('from ')) features.push('from-imports');
				if (content.includes('@')) features.push('decorators');
				if (content.includes('__init__')) features.push('constructors');
			}

			return features;
		} catch (error) {
			console.error(`Error identifying features in ${filePath}:`, error);
			throw new Error(`Failed to identify features: ${filePath}`);
		}
	}

	// --- SYMBOL EXTRACTION PRIMITIVES ---

	/**
	 * Extract symbols from a chunk of code
	 */
	extractSymbolsFromChunk(
		filePath: string,
		chunk: {content: string; startLine: number; endLine: number; type?: string},
	): CodeSymbol[] {
		const symbols: CodeSymbol[] = [];

		// This is a simplified implementation that uses regex patterns to extract symbols
		// A real implementation would use a proper parser like Tree-sitter

		const extension = path.extname(filePath);
		// const lines = chunk.content.split('\n');

		// Extract based on file type
		if (
			extension === '.js' ||
			extension === '.ts' ||
			extension === '.jsx' ||
			extension === '.tsx'
		) {
			// Function extraction using regex
			const functionPattern = /(?:function\s+)(\w+)\s*\(([^)]*)\)/g;
			const arrowFunctionPattern =
				/(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/g;
			const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
			const methodPattern = /(\w+)\s*\([^)]*\)\s*{/g;

			let match;

			// Extract regular functions
			while ((match = functionPattern.exec(chunk.content)) !== null) {
				const name = match[1];
				const parametersStr = match[2];
				const startPosition = chunk.content.indexOf(match[0]);
				const startLine =
					chunk.startLine +
					countLines(chunk.content.substring(0, startPosition));

				symbols.push({
					name: name?.trim()!,
					type: 'function',
					location: {
						filePath,
						startLine,
						endLine: startLine + 1, // Simplified - not accurate
						startColumn: 0,
						endColumn: 0,
					},
					signature: `function ${name}(${parametersStr})`,
					content: match[0],
				});
			}

			// Extract arrow functions
			while ((match = arrowFunctionPattern.exec(chunk.content)) !== null) {
				const name = match[1];
				const startPosition = chunk.content.indexOf(match[0]);
				const startLine =
					chunk.startLine +
					countLines(chunk.content.substring(0, startPosition));

				symbols.push({
					name: name?.trim()!,
					type: 'function',
					location: {
						filePath,
						startLine,
						endLine: startLine + 1, // Simplified - not accurate
						startColumn: 0,
						endColumn: 0,
					},
					content: match[0],
				});
			}

			// Extract classes
			while ((match = classPattern.exec(chunk.content)) !== null) {
				const name = match[1];
				const parentClass = match[2];
				const startPosition = chunk.content.indexOf(match[0]);
				const startLine =
					chunk.startLine +
					countLines(chunk.content.substring(0, startPosition));

				symbols.push({
					name: name?.trim()!,
					type: 'class',
					location: {
						filePath,
						startLine,
						endLine: startLine + 1, // Simplified - not accurate
						startColumn: 0,
						endColumn: 0,
					},
					parent: parentClass,
					content: match[0],
				});
			}

			// Extract methods
			while ((match = methodPattern.exec(chunk.content)) !== null) {
				const name = match[1];

				// Skip methods like "constructor", "function", common keywords
				if (
					['constructor', 'function', 'if', 'for', 'while', 'switch'].includes(
						name!,
					)
				) {
					continue;
				}

				const startPosition = chunk.content.indexOf(match[0]);
				const startLine =
					chunk.startLine +
					countLines(chunk.content.substring(0, startPosition));

				symbols.push({
					name: name?.trim()!,
					type: 'method',
					location: {
						filePath,
						startLine,
						endLine: startLine + 1, // Simplified - not accurate
						startColumn: 0,
						endColumn: 0,
					},
					content: match[0],
				});
			}
		}

		// Add more languages as needed

		return symbols;
	}

	/**
	 * Extract dependencies from a chunk of code
	 */
	extractDependenciesFromChunk(
		filePath: string,
		chunk: {content: string; startLine: number; endLine: number; type?: string},
	): CodeDependency[] {
		const dependencies: CodeDependency[] = [];

		// This is a simplified implementation that uses regex patterns to extract dependencies
		// A real implementation would use a proper parser like Tree-sitter

		const extension = path.extname(filePath);

		// Extract based on file type
		if (
			extension === '.js' ||
			extension === '.ts' ||
			extension === '.jsx' ||
			extension === '.tsx'
		) {
			// Import dependencies
			const importPattern =
				/import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
			const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

			let match;

			// Extract ES module imports
			while ((match = importPattern.exec(chunk.content)) !== null) {
				const target = match[1]!;

				dependencies.push({
					source: filePath,
					target,
					type: 'import',
				});
			}

			// Extract CommonJS requires
			while ((match = requirePattern.exec(chunk.content)) !== null) {
				const target = match[1]!;

				dependencies.push({
					source: filePath,
					target,
					type: 'import',
				});
			}
		}

		// Add more languages as needed

		return dependencies;
	}

	// --- STORAGE MANAGEMENT PRIMITIVES ---

	/**
	 * Store a code symbol
	 */
	storeSymbol(symbol: CodeSymbol): void {
		const id = `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`;
		this.symbols.set(id, symbol);
	}

	/**
	 * Store multiple code symbols
	 */
	storeSymbols(symbols: CodeSymbol[]): void {
		for (const symbol of symbols) {
			this.storeSymbol(symbol);
		}
	}

	/**
	 * Store a dependency
	 */
	storeDependency(dependency: CodeDependency): void {
		this.dependencies.push(dependency);
	}

	/**
	 * Store multiple dependencies
	 */
	storeDependencies(dependencies: CodeDependency[]): void {
		this.dependencies.push(...dependencies);
	}

	/**
	 * Get all stored symbols
	 */
	getSymbols(): CodeSymbol[] {
		return Array.from(this.symbols.values());
	}

	/**
	 * Get all stored dependencies
	 */
	getDependencies(): CodeDependency[] {
		return this.dependencies;
	}

	/**
	 * Get all stored chunks for a file
	 */
	getChunks(filePath: string): Array<{
		content: string;
		startLine: number;
		endLine: number;
		type?: string;
	}> {
		return this.chunks.get(filePath) || [];
	}

	/**
	 * Reset all stored data
	 */
	reset(): void {
		this.symbols.clear();
		this.dependencies = [];
		this.chunks.clear();
		this.fileContents.clear();
	}
}

// Helper function to count number of lines in a string
function countLines(str: string): number {
	return (str.match(/\n/g) || []).length;
}
