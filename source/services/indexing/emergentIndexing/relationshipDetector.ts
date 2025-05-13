/**
 * Relationship Detector
 *
 * Discovers relationships between elements in the codebase.
 */

import {v4 as uuidv4} from 'uuid';
import path from 'path';
import {
	CodebaseUnderstanding,
	Relationship,
	RelationshipType,
	// CodeNode, // Unused import
	CodeNodeType,
	FileNode,
} from './types.js';

/**
 * Relationship detector for finding connections between code elements
 */
export class RelationshipDetector {
	/**
	 * Detect relationships between elements in the codebase
	 */
	async detectRelationships(
		understanding: CodebaseUnderstanding,
	): Promise<Relationship[]> {
		console.log('Detecting relationships in the codebase...');

		const relationships: Relationship[] = [];

		// Detect containment relationships (directories containing files, files containing code units)
		relationships.push(
			...(await this.detectContainmentRelationships(understanding)),
		);

		// Detect import/export relationships
		relationships.push(
			...(await this.detectImportExportRelationships(understanding)),
		);

		// Detect inheritance relationships
		relationships.push(
			...(await this.detectInheritanceRelationships(understanding)),
		);

		// Detect similar files
		relationships.push(...(await this.detectSimilarFiles(understanding)));

		return relationships;
	}

	/**
	 * Detect containment relationships
	 * @private
	 */
	private async detectContainmentRelationships(
		understanding: CodebaseUnderstanding,
	): Promise<Relationship[]> {
		const relationships: Relationship[] = [];

		// Add parent-child relationships from code nodes
		for (const node of understanding.codeNodes.values()) {
			if (node.parent) {
				const parentNode = understanding.codeNodes.get(node.parent.id);
				if (parentNode) {
					relationships.push({
						id: uuidv4(),
						type: RelationshipType.CONTAINS,
						sourceId: parentNode.id,
						targetId: node.id,
						metadata: {},
						weight: 1.0,
						confidence: 1.0,
					});
				}
			}
		}

		// Add file-module relationships
		for (const node of understanding.codeNodes.values()) {
			if (node.type === CodeNodeType.MODULE) {
				// Find the corresponding file
				const fileNode = this.findFileByPath(understanding, node.path);
				if (fileNode) {
					relationships.push({
						id: uuidv4(),
						type: RelationshipType.CONTAINS,
						sourceId: `file:${fileNode.path}`,
						targetId: node.id,
						metadata: {
							fileType: fileNode.extension,
						},
						weight: 1.0,
						confidence: 1.0,
					});
				}
			}
		}

		return relationships;
	}

	/**
	 * Detect import/export relationships
	 * @private
	 */
	private async detectImportExportRelationships(
		understanding: CodebaseUnderstanding,
	): Promise<Relationship[]> {
		const relationships: Relationship[] = [];

		// This is a simplified approach that would need to be enhanced with actual import analysis
		// For each module, try to guess imports based on content
		for (const sourceNode of understanding.codeNodes.values()) {
			if (
				sourceNode.type === CodeNodeType.MODULE &&
				typeof sourceNode.content === 'string'
			) {
				const content = sourceNode.content;

				// Simple regex to find imports (this is a basic approach, would need language-specific parsing)
				const importMatches = content.match(
					/import\s+(?:{[^}]+}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g,
				);

				if (importMatches) {
					for (const match of importMatches) {
						const modulePathMatch = match.match(/from\s+['"]([^'"]+)['"]/);
						if (modulePathMatch) {
							const modulePath = modulePathMatch[1];

							// Try to find the target module
							for (const targetNode of understanding.codeNodes.values()) {
								if (
									targetNode.type === CodeNodeType.MODULE &&
									targetNode.id !== sourceNode.id
								) {
									const targetPath = targetNode.path;

									// This is a very simplistic matching and would need improvement
									if (
										this.couldImport(
											sourceNode.path,
											targetPath,
											modulePath || '',
										)
									) {
										relationships.push({
											id: uuidv4(),
											type: RelationshipType.IMPORTS,
											sourceId: sourceNode.id,
											targetId: targetNode.id,
											metadata: {
												importPath: modulePath,
											},
											weight: 1.0,
											confidence: 0.7, // Lower confidence due to heuristic matching
										});
									}
								}
							}
						}
					}
				}
			}
		}

		return relationships;
	}

	/**
	 * Detect inheritance relationships
	 * @private
	 */
	private async detectInheritanceRelationships(
		understanding: CodebaseUnderstanding,
	): Promise<Relationship[]> {
		const relationships: Relationship[] = [];

		// Map of class/interface names to their node IDs
		const nameToNodeId: Record<string, string[]> = {};

		// Build the map for lookup
		for (const node of understanding.codeNodes.values()) {
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

		// Look for inheritance patterns in class nodes
		for (const node of understanding.codeNodes.values()) {
			if (
				node.type === CodeNodeType.CLASS &&
				typeof node.content === 'string'
			) {
				const content = node.content;

				// Look for "extends" in class content (simplified approach)
				const extendsMatch = content.match(/extends\s+(\w+)/);
				if (extendsMatch) {
					const parentClassName = extendsMatch[1];

					// Find potential parent class nodes
					const parentNodeIds = nameToNodeId[parentClassName || ''];
					if (parentNodeIds) {
						for (const parentId of parentNodeIds) {
							relationships.push({
								id: uuidv4(),
								type: RelationshipType.EXTENDS,
								sourceId: node.id,
								targetId: parentId,
								metadata: {},
								weight: 1.0,
								confidence: 0.8,
							});
						}
					}
				}

				// Look for "implements" in class content (simplified approach)
				const implementsMatches = content.match(/implements\s+([^{]+)/);
				if (implementsMatches) {
					const interfaceList = implementsMatches[1]?.trim().split(/,\s*/);

					for (const interfaceName of interfaceList || []) {
						const interfaceNodeIds = nameToNodeId[interfaceName];
						if (interfaceNodeIds) {
							for (const interfaceId of interfaceNodeIds) {
								relationships.push({
									id: uuidv4(),
									type: RelationshipType.IMPLEMENTS,
									sourceId: node.id,
									targetId: interfaceId,
									metadata: {},
									weight: 1.0,
									confidence: 0.8,
								});
							}
						}
					}
				}
			}
		}

		return relationships;
	}

	/**
	 * Detect similar files
	 * @private
	 */
	private async detectSimilarFiles(
		understanding: CodebaseUnderstanding,
	): Promise<Relationship[]> {
		const relationships: Relationship[] = [];

		// Group files by extension
		const filesByExtension: Record<string, FileNode[]> = {};

		// Helper function to find all files
		const findAllFiles = (node: any): void => {
			if ('extension' in node) {
				const ext = node.extension.toLowerCase();
				if (!filesByExtension[ext]) {
					filesByExtension[ext] = [];
				}
				filesByExtension[ext].push(node);
			} else if ('children' in node && node.children) {
				for (const child of node.children) {
					findAllFiles(child);
				}
			}
		};

		findAllFiles(understanding.fileSystem.root);

		// For each extension group, find similar files by name
		for (const [_ext, files] of Object.entries(filesByExtension)) {
			if (files.length < 2) continue;

			// Group by name patterns
			const filesByPattern: Record<string, FileNode[]> = {};

			for (const file of files) {
				// Extract base name without extension
				const basename = path.basename(file.path, file.extension);

				// Try to find a pattern in the name
				const pattern = this.extractNamePattern(basename);

				if (!filesByPattern[pattern]) {
					filesByPattern[pattern] = [];
				}
				filesByPattern[pattern].push(file);
			}

			// Create similarity relationships for files with the same pattern
			for (const [pattern, patternFiles] of Object.entries(filesByPattern)) {
				if (patternFiles.length < 2 || pattern === '*') continue;

				// Create relationships between all files with this pattern
				for (let i = 0; i < patternFiles.length; i++) {
					for (let j = i + 1; j < patternFiles.length; j++) {
						relationships.push({
							id: uuidv4(),
							type: RelationshipType.SIMILAR_TO,
							sourceId: `file:${patternFiles[i]?.path}`,
							targetId: `file:${patternFiles[j]?.path}`,
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
		}

		return relationships;
	}

	/**
	 * Find a file by path
	 * @private
	 */
	private findFileByPath(
		understanding: CodebaseUnderstanding,
		filePath: string,
	): FileNode | null {
		// Helper function to search recursively
		const search = (node: any): FileNode | null => {
			if ('extension' in node && node.path === filePath) {
				return node;
			}

			if ('children' in node && node.children) {
				for (const child of node.children) {
					const found = search(child);
					if (found) return found;
				}
			}

			return null;
		};

		return search(understanding.fileSystem.root);
	}

	/**
	 * Check if one file could import another based on the import path
	 * @private
	 */
	private couldImport(
		sourcePath: string,
		targetPath: string,
		importPath: string,
	): boolean {
		// This is a simplistic approach that would need to be enhanced
		// with actual module resolution logic for the specific language and framework

		// Case 1: Absolute import
		if (importPath.startsWith('/')) {
			return targetPath.endsWith(importPath);
		}

		// Case 2: Relative import
		if (importPath.startsWith('./') || importPath.startsWith('../')) {
			const sourceDir = path.dirname(sourcePath);
			const resolvedPath = path.resolve(sourceDir, importPath);

			// Check if the target path matches the resolved import path
			return (
				targetPath === resolvedPath ||
				targetPath === `${resolvedPath}.js` ||
				targetPath === `${resolvedPath}.ts` ||
				targetPath === `${resolvedPath}.jsx` ||
				targetPath === `${resolvedPath}.tsx` ||
				targetPath === `${resolvedPath}/index.js` ||
				targetPath === `${resolvedPath}/index.ts` ||
				targetPath === `${resolvedPath}/index.jsx` ||
				targetPath === `${resolvedPath}/index.tsx`
			);
		}

		// Case 3: Package import (simplified check)
		const targetBaseName = path.basename(targetPath, path.extname(targetPath));
		return importPath.includes(targetBaseName);
	}

	/**
	 * Extract a pattern from a filename
	 * @private
	 */
	private extractNamePattern(name: string): string {
		// This is a simplified approach to finding patterns in filenames

		// Check for common patterns

		// React component pattern
		if (/^[A-Z][a-zA-Z]*$/.test(name)) {
			return 'Component';
		}

		// Test file pattern
		if (
			name.includes('.test') ||
			name.includes('.spec') ||
			name.startsWith('test') ||
			name.endsWith('Test')
		) {
			return 'Test';
		}

		// Model/entity pattern
		if (name.endsWith('Model') || name.endsWith('Entity')) {
			return 'Model';
		}

		// Service pattern
		if (name.endsWith('Service')) {
			return 'Service';
		}

		// Controller pattern
		if (name.endsWith('Controller')) {
			return 'Controller';
		}

		// Utility pattern
		if (
			name.endsWith('Util') ||
			name.endsWith('Utils') ||
			name.endsWith('Helper') ||
			name.endsWith('Helpers')
		) {
			return 'Utility';
		}

		// Hook pattern (React)
		if (name.startsWith('use') && /[A-Z]/.test(name.charAt(3))) {
			return 'Hook';
		}

		// If no specific pattern is recognized, use a generic placeholder
		return '*';
	}
}
