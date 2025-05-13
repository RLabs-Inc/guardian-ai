/**
 * Index Storage for persisting and retrieving the index tree
 */

import fs from 'fs';
import path from 'path';
import { IndexNode } from './types.js';

export class IndexStorage {
  /**
   * Save the index to storage
   * @param index Index root node
   * @param storagePath Path where to save the index
   */
  async saveIndex(index: IndexNode, storagePath: string): Promise<void> {
    try {
      // Create directory if it doesn't exist
      const dirPath = path.dirname(storagePath);
      await fs.promises.mkdir(dirPath, { recursive: true });
      
      // Prepare index for serialization
      const serializedIndex = this.prepareForSerialization(index);
      
      // Write to file
      await fs.promises.writeFile(
        storagePath,
        JSON.stringify(serializedIndex, null, 2),
        'utf8'
      );
      
      console.log(`Index saved to ${storagePath}`);
    } catch (error) {
      console.error('Error saving index:', error);
      throw error;
    }
  }
  
  /**
   * Load an index from storage
   * @param storagePath Path to the stored index
   */
  async loadIndex(storagePath: string): Promise<IndexNode> {
    try {
      // Read from file
      const data = await fs.promises.readFile(storagePath, 'utf8');
      
      // Parse JSON
      const serializedIndex = JSON.parse(data);
      
      // Restore full index structure
      return this.restoreFromSerialization(serializedIndex);
    } catch (error) {
      console.error('Error loading index:', error);
      throw error;
    }
  }
  
  /**
   * Split the index into multiple files for efficient storage
   * @param index Index root node
   * @param baseDir Base directory for the split files
   */
  async splitIndex(index: IndexNode, baseDir: string): Promise<string> {
    try {
      // Create the base directory
      await fs.promises.mkdir(baseDir, { recursive: true });
      
      // Get a flattened list of all nodes
      const allNodes = this.flattenNodes(index);
      
      // Group nodes by their parent
      const nodesByParent: Record<string, IndexNode[]> = {};
      for (const node of allNodes) {
        if (node.parent) {
          const parentId = node.parent.id;
          if (!nodesByParent[parentId]) {
            nodesByParent[parentId] = [];
          }
          nodesByParent[parentId].push(node);
        }
      }
      
      // Start with the root node
      const rootPath = path.join(baseDir, 'root.json');
      
      // Create a simplified root node
      const rootNode = { ...index };
      // Don't include children, just references
      rootNode.children = index.children?.map(child => ({
        id: child.id,
        type: child.type,
        name: child.name,
        path: child.path,
        reference: `${child.id}.json`
      })) as any;
      
      // Save the root node
      await fs.promises.writeFile(
        rootPath,
        JSON.stringify(rootNode, null, 2),
        'utf8'
      );
      
      // Save each parent's children
      for (const [parentId, children] of Object.entries(nodesByParent)) {
        const parentPath = path.join(baseDir, `${parentId}.json`);
        
        // Simplify children references
        const simplifiedChildren = children.map(child => {
          const simplified = { ...child };
          // Replace children with references
          if (child.children?.length) {
            simplified.children = child.children.map(grandchild => ({
              id: grandchild.id,
              type: grandchild.type,
              name: grandchild.name,
              path: grandchild.path,
              reference: `${grandchild.id}.json`
            })) as any;
          }
          return simplified;
        });
        
        // Save the children
        await fs.promises.writeFile(
          parentPath,
          JSON.stringify(simplifiedChildren, null, 2),
          'utf8'
        );
      }
      
      return rootPath;
    } catch (error) {
      console.error('Error splitting index:', error);
      throw error;
    }
  }
  
  /**
   * Load a split index from storage
   * @param rootPath Path to the root index file
   */
  async loadSplitIndex(rootPath: string): Promise<IndexNode> {
    try {
      // Read the root node
      const rootData = await fs.promises.readFile(rootPath, 'utf8');
      const rootNode = JSON.parse(rootData);
      
      // Get the base directory
      const baseDir = path.dirname(rootPath);
      
      // Load root node's children
      await this.loadSplitIndexChildren(rootNode, baseDir);
      
      return rootNode;
    } catch (error) {
      console.error('Error loading split index:', error);
      throw error;
    }
  }
  
  /**
   * Recursively load children for a node in a split index
   * @private
   */
  private async loadSplitIndexChildren(node: IndexNode, baseDir: string): Promise<void> {
    if (!node.children) {
      return;
    }
    
    const childrenToLoad: IndexNode[] = [];
    
    // Find any child references that need to be loaded
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i] as any;
      if (child.reference) {
        // Load the child's data
        const childPath = path.join(baseDir, child.reference);
        try {
          const childData = await fs.promises.readFile(childPath, 'utf8');
          const loadedChildren = JSON.parse(childData) as IndexNode[];
          
          // Replace the reference with the actual children
          node.children[i] = {
            ...child,
            children: loadedChildren
          };
          
          // Add children to the list to load their children
          if (node.children && i < node.children.length && node.children[i]) {
            const childNode = node.children[i];
            // Type assertion since we've checked it exists
            childrenToLoad.push(childNode as IndexNode);
          }
        } catch (error) {
          console.warn(`Could not load child reference ${child.reference}:`, error);
        }
      } else {
        // Add regular children to the list to load their children
        if (child) {
          childrenToLoad.push(child);
        }
      }
    }
    
    // Recursively load children for all nodes
    for (const child of childrenToLoad) {
      await this.loadSplitIndexChildren(child, baseDir);
    }
  }
  
  /**
   * Prepare an index for serialization
   * @private
   */
  private prepareForSerialization(node: IndexNode): any {
    // Create a copy to avoid modifying the original
    const copy: any = { ...node };
    
    // Convert content reference to a string format if needed
    if (typeof copy.content === 'object' && copy.content !== null) {
      copy.content = JSON.stringify(copy.content);
    }
    
    // Recursively prepare children
    if (copy.children) {
      copy.children = copy.children.map((child: IndexNode) => 
        this.prepareForSerialization(child)
      );
    }
    
    return copy;
  }
  
  /**
   * Restore an index from serialization
   * @private
   */
  private restoreFromSerialization(data: any): IndexNode {
    // Create a copy to avoid modifying the original
    const copy: IndexNode = { ...data };
    
    // Restore content reference if needed
    if (typeof copy.content === 'string' && copy.content.startsWith('{')) {
      try {
        copy.content = JSON.parse(copy.content);
      } catch (e) {
        // If it's not valid JSON, leave it as a string
      }
    }
    
    // Recursively restore children
    if (copy.children) {
      copy.children = copy.children.map((child: any) => {
        const restoredChild = this.restoreFromSerialization(child);
        // Add parent reference
        restoredChild.parent = {
          id: copy.id,
          type: copy.type
        };
        return restoredChild;
      });
    }
    
    return copy;
  }
  
  /**
   * Flatten an index tree into a list of nodes
   * @private
   */
  private flattenNodes(node: IndexNode): IndexNode[] {
    const result: IndexNode[] = [node];
    
    if (node.children) {
      for (const child of node.children) {
        result.push(...this.flattenNodes(child));
      }
    }
    
    return result;
  }
}