/**
 * Pattern Discovery
 *
 * Discovers recurring patterns in the codebase.
 */

import {v4 as uuidv4} from 'uuid';
import {CodebaseUnderstanding, CodePattern, CodeNode} from './types.js';

/**
 * Pattern discovery service for finding patterns in code
 */
export class PatternDiscovery {
	/**
	 * Discover patterns in the codebase
	 */
	async discoverPatterns(
		understanding: CodebaseUnderstanding,
	): Promise<CodePattern[]> {
		console.log('Discovering patterns in the codebase...');

		const patterns: CodePattern[] = [];

		// Start with simple structural patterns as a baseline
		patterns.push(...(await this.discoverStructuralPatterns(understanding)));

		// Discover naming convention patterns
		patterns.push(...(await this.discoverNamingPatterns(understanding)));

		// Discover file organization patterns
		patterns.push(
			...(await this.discoverFileOrganizationPatterns(understanding)),
		);

		// Sort patterns by frequency and confidence
		return patterns.sort((a, b) => {
			// Sort by frequency first
			if (b.frequency !== a.frequency) {
				return b.frequency - a.frequency;
			}
			// Then by confidence
			return b.confidence - a.confidence;
		});
	}

	/**
	 * Discover structural patterns
	 * @private
	 */
	private async discoverStructuralPatterns(
		understanding: CodebaseUnderstanding,
	): Promise<CodePattern[]> {
		const patterns: CodePattern[] = [];
		const nodesByType: Record<string, CodeNode[]> = {};

		// Group nodes by type
		for (const node of understanding.codeNodes.values()) {
			if (!nodesByType[node.type]) {
				nodesByType[node.type] = [];
			}
			nodesByType[node.type]?.push(node);
		}

		// For each type, try to find common structures
		for (const [type, nodes] of Object.entries(nodesByType)) {
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
				importance: 0.5,
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
		}

		return patterns;
	}

	/**
	 * Discover naming convention patterns
	 * @private
	 */
	private async discoverNamingPatterns(
		understanding: CodebaseUnderstanding,
	): Promise<CodePattern[]> {
		const patterns: CodePattern[] = [];

		// Simple naming convention detection
		// First, analyze all node names to detect common prefixes, suffixes, and casing styles
		const casingCounts = {
			camelCase: 0,
			PascalCase: 0,
			snake_case: 0,
			kebab_case: 0,
			ALL_CAPS: 0,
		};

		const prefixCounts: Record<string, number> = {};
		const suffixCounts: Record<string, number> = {};

		// Count instances of different naming styles
		for (const node of understanding.codeNodes.values()) {
			const name = node.name;

			// Skip empty names or single-character names
			if (!name || name.length <= 1) continue;

			// Check casing style
			if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
				casingCounts.PascalCase++;
			} else if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) {
				casingCounts.camelCase++;
			} else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) {
				casingCounts.snake_case++;
			} else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
				casingCounts.kebab_case++;
			} else if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name)) {
				casingCounts.ALL_CAPS++;
			}

			// Check for common prefixes (3 chars or more)
			for (let i = 3; i <= Math.min(name.length / 2, 5); i++) {
				const prefix = name.substring(0, i);
				prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
			}

			// Check for common suffixes (3 chars or more)
			for (let i = 3; i <= Math.min(name.length / 2, 5); i++) {
				const suffix = name.substring(name.length - i);
				suffixCounts[suffix] = (suffixCounts[suffix] || 0) + 1;
			}
		}

		// Find dominant casing style
		let dominantStyle = '';
		let maxCount = 0;

		for (const [style, count] of Object.entries(casingCounts)) {
			if (count > maxCount) {
				maxCount = count;
				dominantStyle = style;
			}
		}

		// Create a pattern if there's a clear dominant style
		const totalNodes = understanding.codeNodes.size;
		if (maxCount > 0 && maxCount / totalNodes > 0.3) {
			const casingPattern: CodePattern = {
				id: uuidv4(),
				type: 'naming',
				name: `${dominantStyle} convention`,
				description: `Names predominantly use ${dominantStyle} convention`,
				signature: {
					style: dominantStyle,
					regex: this.getCasingStyleRegex(dominantStyle),
				},
				instances: [],
				confidence: maxCount / totalNodes,
				frequency: maxCount,
				importance: 0.7,
			};

			// Add instances
			for (const node of understanding.codeNodes.values()) {
				if (this.matchesCasingStyle(node.name, dominantStyle)) {
					casingPattern.instances.push({
						nodeId: node.id,
						nodePath: node.path,
						matchScore: 1.0,
						metadata: {},
					});
				}
			}

			patterns.push(casingPattern);
		}

		// Find significant prefixes and suffixes (used in at least 10% of names)
		const significanceThreshold = Math.max(3, totalNodes * 0.1);

		// Add prefix patterns
		for (const [prefix, count] of Object.entries(prefixCounts)) {
			if (count >= significanceThreshold) {
				const prefixPattern: CodePattern = {
					id: uuidv4(),
					type: 'naming',
					name: `${prefix}* prefix convention`,
					description: `Names commonly start with "${prefix}"`,
					signature: {
						type: 'prefix',
						value: prefix,
					},
					instances: [],
					confidence: count / totalNodes,
					frequency: count,
					importance: 0.6,
				};

				// Add instances
				for (const node of understanding.codeNodes.values()) {
					if (node.name.startsWith(prefix)) {
						prefixPattern.instances.push({
							nodeId: node.id,
							nodePath: node.path,
							matchScore: 1.0,
							metadata: {},
						});
					}
				}

				patterns.push(prefixPattern);
			}
		}

		// Add suffix patterns
		for (const [suffix, count] of Object.entries(suffixCounts)) {
			if (count >= significanceThreshold) {
				const suffixPattern: CodePattern = {
					id: uuidv4(),
					type: 'naming',
					name: `*${suffix} suffix convention`,
					description: `Names commonly end with "${suffix}"`,
					signature: {
						type: 'suffix',
						value: suffix,
					},
					instances: [],
					confidence: count / totalNodes,
					frequency: count,
					importance: 0.6,
				};

				// Add instances
				for (const node of understanding.codeNodes.values()) {
					if (node.name.endsWith(suffix)) {
						suffixPattern.instances.push({
							nodeId: node.id,
							nodePath: node.path,
							matchScore: 1.0,
							metadata: {},
						});
					}
				}

				patterns.push(suffixPattern);
			}
		}

		return patterns;
	}

	/**
	 * Discover file organization patterns
	 * @private
	 */
	private async discoverFileOrganizationPatterns(
		understanding: CodebaseUnderstanding,
	): Promise<CodePattern[]> {
		const patterns: CodePattern[] = [];

		// Analyze file organization by looking at directory structures
		const fileSystem = understanding.fileSystem;
		const directories = this.getDirectories(fileSystem.root);

		// Extract directory names
		const dirNames = directories.map(dir => dir.name);

		// Count occurrences of common directory names
		const commonDirNames = [
			'src',
			'source',
			'lib',
			'app',
			'components',
			'utils',
			'helpers',
			'services',
			'models',
			'views',
			'controllers',
			'config',
			'docs',
			'test',
			'tests',
			'specs',
			'__tests__',
			'public',
			'static',
			'assets',
			'images',
			'styles',
			'css',
		];

		const dirNameCounts: Record<string, number> = {};
		for (const name of commonDirNames) {
			const count = dirNames.filter(
				n => n.toLowerCase() === name.toLowerCase(),
			).length;
			if (count > 0) {
				dirNameCounts[name] = count;
			}
		}

		// Create patterns for common directory structures
		// Look for feature-based organization (directories named after features)
		const featureBasedDirs = directories.filter(dir => {
			// Exclude common utility/infrastructure directories
			const name = dir.name.toLowerCase();
			return (
				!commonDirNames.includes(name) &&
				dir.children.length > 1 &&
				dir.children.some((c: any) => 'children' in c)
			);
		});

		if (featureBasedDirs.length >= 3) {
			// This might be a feature-based organization
			const featurePattern: CodePattern = {
				id: uuidv4(),
				type: 'organization',
				name: 'Feature-based organization',
				description:
					'Code is organized by feature/domain rather than technical concerns',
				signature: {
					type: 'directory_structure',
					feature_based: true,
				},
				instances: featureBasedDirs.map(dir => ({
					nodeId: `dir:${dir.path}`,
					nodePath: dir.path,
					matchScore: 1.0,
					metadata: {
						childCount: dir.children.length,
					},
				})),
				confidence: 0.7,
				frequency: featureBasedDirs.length,
				importance: 0.8,
			};

			patterns.push(featurePattern);
		}

		// Check for technical separation (e.g., MVC pattern)
		const mvcPattern = ['models', 'views', 'controllers'].every(dir =>
			dirNames.some(name => name.toLowerCase() === dir),
		);

		if (mvcPattern) {
			patterns.push({
				id: uuidv4(),
				type: 'organization',
				name: 'MVC pattern',
				description: 'Code follows Model-View-Controller architectural pattern',
				signature: {
					type: 'directory_structure',
					pattern: 'mvc',
				},
				instances: directories
					.filter(dir =>
						['models', 'views', 'controllers'].includes(dir.name.toLowerCase()),
					)
					.map(dir => ({
						nodeId: `dir:${dir.path}`,
						nodePath: dir.path,
						matchScore: 1.0,
						metadata: {},
					})),
				confidence: 0.9,
				frequency: 3,
				importance: 0.9,
			});
		}

		return patterns;
	}

	/**
	 * Get all directories from the file system tree
	 * @private
	 */
	private getDirectories(root: any): any[] {
		const dirs: any[] = [];

		const traverse = (node: any) => {
			if (!('extension' in node) && 'children' in node) {
				dirs.push(node);

				for (const child of node.children) {
					if (!('extension' in child) && 'children' in child) {
						traverse(child);
					}
				}
			}
		};

		traverse(root);
		return dirs;
	}

	/**
	 * Check if a name matches a casing style
	 * @private
	 */
	private matchesCasingStyle(name: string, style: string): boolean {
		switch (style) {
			case 'camelCase':
				return /^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name);
			case 'PascalCase':
				return /^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name);
			case 'snake_case':
				return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name);
			case 'kebab_case':
				return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
			case 'ALL_CAPS':
				return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name);
			default:
				return false;
		}
	}

	/**
	 * Get a regex for a casing style
	 * @private
	 */
	private getCasingStyleRegex(style: string): string {
		switch (style) {
			case 'camelCase':
				return '^[a-z][a-z0-9]*([A-Z][a-z0-9]*)*$';
			case 'PascalCase':
				return '^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$';
			case 'snake_case':
				return '^[a-z][a-z0-9]*(_[a-z0-9]+)*$';
			case 'kebab_case':
				return '^[a-z][a-z0-9]*(-[a-z0-9]+)*$';
			case 'ALL_CAPS':
				return '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$';
			default:
				return '.*';
		}
	}
}
