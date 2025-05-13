/**
 * Hash tracking system for detecting changes in the codebase
 */

import crypto from 'crypto';
import { IndexNode } from './types.js';

export class HashTracker {
  /**
   * Compute a hash for a node based on its content and children
   * @param node The node to hash
   */
  computeNodeHash(node: IndexNode): string {
    // If this is a leaf node with content, use its existing hash
    if (typeof node.content === 'string' && !node.children?.length) {
      return node.contentHash;
    }
    
    // For nodes with children, combine all children hashes
    if (node.children?.length) {
      const childrenHashes = node.children.map(child => child.contentHash).join('');
      return crypto.createHash('sha256').update(childrenHashes).digest('hex');
    }
    
    // For nodes with reference content, compute based on metadata
    const metadataStr = JSON.stringify(node.metadata || {});
    return crypto.createHash('sha256').update(metadataStr).digest('hex');
  }
  
  /**
   * Update a node's hash and all of its ancestors recursively
   * @param node The node to update
   */
  updateNodeHash(node: IndexNode): void {
    // First update all children recursively
    if (node.children?.length) {
      for (const child of node.children) {
        this.updateNodeHash(child);
      }
    }
    
    // Then compute this node's hash
    node.contentHash = this.computeNodeHash(node);
  }
  
  /**
   * Check if a node's hash matches a given hash
   * @param node The node to check
   * @param hash The hash to compare against
   */
  isHashMatch(node: IndexNode, hash: string): boolean {
    return node.contentHash === hash;
  }
  
  /**
   * Find changed nodes by comparing hashes
   * @param oldNode Previous version of a node
   * @param newNode Current version of a node
   */
  findChangedNodes(oldNode: IndexNode, newNode: IndexNode): IndexNode[] {
    const changedNodes: IndexNode[] = [];
    
    // Compare hashes at this level
    if (oldNode.contentHash !== newNode.contentHash) {
      changedNodes.push(newNode);
      
      // If both have children, recurse into them
      if (oldNode.children?.length && newNode.children?.length) {
        // Create maps for faster lookups
        const oldChildren = new Map(oldNode.children.map(child => [child.name, child]));
        const newChildren = new Map(newNode.children.map(child => [child.name, child]));
        
        // Check each child in new node
        for (const [name, newChild] of newChildren.entries()) {
          const oldChild = oldChildren.get(name);
          
          if (oldChild) {
            // Child exists in both, compare recursively
            changedNodes.push(...this.findChangedNodes(oldChild, newChild));
          } else {
            // Child only exists in new node, consider it changed
            changedNodes.push(newChild);
          }
        }
      }
    }
    
    return changedNodes;
  }
  
  /**
   * Create a hash diff between two nodes
   * @param oldNode Previous version of a node
   * @param newNode Current version of a node
   */
  createHashDiff(oldNode: IndexNode, newNode: IndexNode): {
    added: IndexNode[];
    modified: IndexNode[];
    deleted: string[]; // Paths of deleted nodes
  } {
    const result = {
      added: [] as IndexNode[],
      modified: [] as IndexNode[],
      deleted: [] as string[]
    };
    
    // Basic hash check at this level
    if (oldNode.contentHash !== newNode.contentHash) {
      // Something changed, figure out what
      
      // If content changed but name and path are the same, it's a modification
      if (oldNode.name === newNode.name && oldNode.path === newNode.path) {
        result.modified.push(newNode);
      }
      
      // Check children
      if (oldNode.children?.length || newNode.children?.length) {
        // Maps for faster lookups
        const oldChildren = new Map<string, IndexNode>();
        const newChildren = new Map<string, IndexNode>();
        
        // Populate maps
        if (oldNode.children) {
          for (const child of oldNode.children) {
            oldChildren.set(child.path, child);
          }
        }
        
        if (newNode.children) {
          for (const child of newNode.children) {
            newChildren.set(child.path, child);
          }
        }
        
        // Find added nodes
        for (const [path, newChild] of newChildren.entries()) {
          if (!oldChildren.has(path)) {
            result.added.push(newChild);
          }
        }
        
        // Find deleted nodes
        for (const [path, _oldChild] of oldChildren.entries()) {
          if (!newChildren.has(path)) {
            result.deleted.push(path);
          }
        }
        
        // Find modified nodes (recursive)
        for (const [path, newChild] of newChildren.entries()) {
          const oldChild = oldChildren.get(path);
          if (oldChild && oldChild.contentHash !== newChild.contentHash) {
            // Recurse
            const childDiff = this.createHashDiff(oldChild, newChild);
            result.added.push(...childDiff.added);
            result.modified.push(...childDiff.modified);
            result.deleted.push(...childDiff.deleted);
          }
        }
      }
    }
    
    return result;
  }
}