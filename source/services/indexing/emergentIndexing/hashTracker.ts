/**
 * Hash Tracker
 *
 * Tracks content hashes at various levels to enable efficient incremental indexing.
 */

import crypto from 'crypto';
// import path from 'path';
import {
	FileNode,
	DirectoryNode,
	CodeNode,
	CodebaseUnderstanding,
} from './types.js';

interface HashDiff {
	added: string[];
	modified: string[];
	deleted: string[];
	unchanged: string[];
}

/**
 * Hash tracking service for efficient incremental indexing
 */
export class HashTracker {
	/**
	 * Compute a hash for a file node
	 */
	computeFileHash(content: string): string {
		return crypto.createHash('sha256').update(content).digest('hex');
	}

	/**
	 * Compute a hash for a directory node based on its children
	 */
	computeDirectoryHash(dirNode: DirectoryNode): string {
		if (!dirNode.children || dirNode.children.length === 0) {
			return crypto.createHash('sha256').update(dirNode.path).digest('hex');
		}

		const childrenHashes = dirNode.children
			.map(child => {
				if ('contentHash' in child) {
					return child.contentHash;
				}
				return '';
			})
			.join('');

		return crypto.createHash('sha256').update(childrenHashes).digest('hex');
	}

	/**
	 * Compute a hash for a code node
	 */
	computeCodeNodeHash(node: CodeNode): string {
		if (typeof node.content === 'string') {
			return crypto.createHash('sha256').update(node.content).digest('hex');
		} else if (node.children && node.children.length > 0) {
			const childrenHashes = node.children
				.map(child => child.contentHash)
				.join('');
			return crypto.createHash('sha256').update(childrenHashes).digest('hex');
		} else {
			// Use metadata and other properties if no content or children
			const props = `${node.name}:${node.type}:${JSON.stringify(
				node.metadata,
			)}`;
			return crypto.createHash('sha256').update(props).digest('hex');
		}
	}

	/**
	 * Update all hashes in a codebase understanding
	 */
	updateHashes(understanding: CodebaseUnderstanding): void {
		// Update file system hashes
		this.updateFileSystemHashes(understanding.fileSystem.root);

		// Update code node hashes
		for (const node of understanding.codeNodes.values()) {
			if (!node.children || node.children.length === 0) {
				// Leaf nodes already have hashes computed during initial processing
				continue;
			}

			// Compute hash for parent nodes based on children
			node.contentHash = this.computeCodeNodeHash(node);
		}
	}

	/**
	 * Update hashes for the file system tree
	 * @private
	 */
	private updateFileSystemHashes(node: DirectoryNode | FileNode): void {
		if ('extension' in node) {
			// This is a file node, hash already computed during initial processing
			return;
		}

		// This is a directory node
		// First update child hashes
		if (node.children) {
			for (const child of node.children) {
				this.updateFileSystemHashes(child);
			}
		}

		// Then compute directory hash based on updated children
		node.contentHash = this.computeDirectoryHash(node);
	}

	/**
	 * Compare two codebase understandings to detect changes
	 */
	compareUnderstandings(
		oldUnderstanding: CodebaseUnderstanding,
		newUnderstanding: CodebaseUnderstanding,
	): {
		fileChanges: HashDiff;
		codeChanges: HashDiff;
	} {
		// Compare file system hashes
		const fileChanges = this.compareFileSystemTrees(
			oldUnderstanding.fileSystem.root,
			newUnderstanding.fileSystem.root,
		);

		// Compare code node hashes
		const codeChanges = this.compareCodeNodes(
			oldUnderstanding.codeNodes,
			newUnderstanding.codeNodes,
		);

		return {
			fileChanges,
			codeChanges,
		};
	}

	/**
	 * Compare two file system trees to detect changes
	 */
	compareFileSystemTrees(
		oldRoot: DirectoryNode,
		newRoot: DirectoryNode,
	): HashDiff {
		const result: HashDiff = {
			added: [],
			modified: [],
			deleted: [],
			unchanged: [],
		};

		// Map old tree by path
		const oldPathMap = new Map<string, FileNode | DirectoryNode>();
		this.mapNodesByPath(oldRoot, oldPathMap);

		// Map new tree by path
		const newPathMap = new Map<string, FileNode | DirectoryNode>();
		this.mapNodesByPath(newRoot, newPathMap);

		// Find added and modified nodes
		for (const [path, newNode] of newPathMap.entries()) {
			const oldNode = oldPathMap.get(path);

			if (!oldNode) {
				// New node
				result.added.push(path);
			} else if (oldNode.contentHash !== newNode.contentHash) {
				// Modified node
				result.modified.push(path);
			} else {
				// Unchanged node
				result.unchanged.push(path);
			}
		}

		// Find deleted nodes
		for (const [path] of oldPathMap.entries()) {
			if (!newPathMap.has(path)) {
				result.deleted.push(path);
			}
		}

		return result;
	}

	/**
	 * Compare two sets of code nodes to detect changes
	 * @private
	 */
	private compareCodeNodes(
		oldNodes: Map<string, CodeNode>,
		newNodes: Map<string, CodeNode>,
	): HashDiff {
		const result: HashDiff = {
			added: [],
			modified: [],
			deleted: [],
			unchanged: [],
		};

		// Find added and modified nodes
		for (const [id, newNode] of newNodes.entries()) {
			const oldNode = oldNodes.get(id);

			if (!oldNode) {
				// New node
				result.added.push(id);
			} else if (oldNode.contentHash !== newNode.contentHash) {
				// Modified node
				result.modified.push(id);
			} else {
				// Unchanged node
				result.unchanged.push(id);
			}
		}

		// Find deleted nodes
		for (const [id] of oldNodes.entries()) {
			if (!newNodes.has(id)) {
				result.deleted.push(id);
			}
		}

		return result;
	}

	/**
	 * Map nodes by path
	 * @private
	 */
	private mapNodesByPath(
		node: DirectoryNode | FileNode,
		pathMap: Map<string, DirectoryNode | FileNode>,
	): void {
		// Add this node to the map
		pathMap.set(node.path, node);

		// Recursively process children if this is a directory
		if ('children' in node && node.children) {
			for (const child of node.children) {
				this.mapNodesByPath(child, pathMap);
			}
		}
	}

	/**
	 * Perform an incremental update of a codebase understanding
	 */
	async performIncrementalUpdate(
		oldUnderstanding: CodebaseUnderstanding,
		_changedPaths: string[],
	): Promise<CodebaseUnderstanding> {
		// This is just a placeholder - in a real implementation, we'd clone
		// the old understanding and then selectively update only the changed parts

		// For now, we'll just mark it as updated
		const newUnderstanding = {...oldUnderstanding};
		newUnderstanding.updatedAt = new Date();

		return newUnderstanding;
	}
}
