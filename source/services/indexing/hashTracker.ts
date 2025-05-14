/**
 * Unified Hash Tracker
 *
 * Tracks content hashes at various levels to enable efficient incremental indexing.
 * Combines the functionality of both hierarchical and emergent indexing hash trackers.
 */

import crypto from 'crypto';
import {
  FileNode,
  DirectoryNode,
  CodeNode,
  UnifiedCodebaseUnderstanding,
  DataNode,
  Relationship,
  CodePattern,
  Concept,
  SemanticUnit,
  CodeCluster
} from './unifiedTypes.js';

/**
 * Hash difference result structure
 */
export interface HashDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}

/**
 * Hash tracking service for efficient incremental indexing
 */
export class HashTracker {
  // File System Hashing

  /**
   * Compute a hash for file content
   */
  computeFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compute a hash for a file node
   */
  computeFileNodeHash(fileNode: FileNode): string {
    if (fileNode.content && typeof fileNode.content === 'string') {
      return this.computeFileHash(fileNode.content);
    }
    
    // For reference content, use metadata and other properties
    const props = `${fileNode.path}:${fileNode.extension}:${JSON.stringify(fileNode.metadata)}`;
    return crypto.createHash('sha256').update(props).digest('hex');
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

  // Code Structure Hashing

  /**
   * Compute a hash for a code node based on its content or children
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
      const props = `${node.name}:${node.type}:${JSON.stringify(node.metadata)}`;
      return crypto.createHash('sha256').update(props).digest('hex');
    }
  }

  // Pattern Hashing

  /**
   * Compute a hash for a pattern
   */
  computePatternHash(pattern: CodePattern): string {
    const patternData = `${pattern.name}:${pattern.type}:${pattern.signature}:${pattern.instances.length}`;
    return crypto.createHash('sha256').update(patternData).digest('hex');
  }

  // Relationship Hashing

  /**
   * Compute a hash for a relationship
   */
  computeRelationshipHash(relationship: Relationship): string {
    const relData = `${relationship.type}:${relationship.sourceId}:${relationship.targetId}:${relationship.weight}`;
    return crypto.createHash('sha256').update(relData).digest('hex');
  }

  // Semantic Structure Hashing

  /**
   * Compute a hash for a concept
   */
  computeConceptHash(concept: Concept): string {
    const conceptData = `${concept.name}:${concept.codeElements.join(',')}:${concept.relatedConcepts.join(',')}`;
    return crypto.createHash('sha256').update(conceptData).digest('hex');
  }

  /**
   * Compute a hash for a semantic unit
   */
  computeSemanticUnitHash(unit: SemanticUnit): string {
    const unitData = `${unit.name}:${unit.type}:${unit.codeNodeIds.join(',')}:${unit.concepts.join(',')}`;
    return crypto.createHash('sha256').update(unitData).digest('hex');
  }

  // Data Flow Hashing

  /**
   * Compute a hash for a data node
   */
  computeDataNodeHash(node: DataNode): string {
    const nodeData = `${node.name}:${node.role}:${node.nodeId}:${JSON.stringify(node.metadata)}`;
    return crypto.createHash('sha256').update(nodeData).digest('hex');
  }

  // Cluster Hashing

  /**
   * Compute a hash for a code cluster
   */
  computeClusterHash(cluster: CodeCluster): string {
    const clusterData = `${cluster.name}:${cluster.nodeIds.join(',')}:${cluster.dominantType}`;
    return crypto.createHash('sha256').update(clusterData).digest('hex');
  }

  // Collective Hashing

  /**
   * Update all hashes in a codebase understanding
   */
  updateHashes(understanding: UnifiedCodebaseUnderstanding): void {
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

    // Metadata hash updates will be performed by specific analyzers
  }

  /**
   * Update hashes for the file system tree
   */
  private updateFileSystemHashes(node: DirectoryNode | FileNode): void {
    if ('extension' in node) {
      // This is a file node, hash might already be computed, but let's ensure
      if (!node.contentHash) {
        node.contentHash = this.computeFileNodeHash(node);
      }
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

  // Comparison and Diffing

  /**
   * Compare two codebase understandings to detect changes
   */
  compareUnderstandings(
    oldUnderstanding: UnifiedCodebaseUnderstanding,
    newUnderstanding: UnifiedCodebaseUnderstanding,
  ): {
    fileSystemChanges: HashDiff;
    codeStructureChanges: HashDiff;
    patternChanges: HashDiff;
    relationshipChanges: HashDiff;
    semanticChanges: HashDiff;
  } {
    // Compare file system hashes
    const fileSystemChanges = this.compareFileSystemTrees(
      oldUnderstanding.fileSystem.root,
      newUnderstanding.fileSystem.root,
    );

    // Compare code node hashes
    const codeStructureChanges = this.compareCodeNodes(
      oldUnderstanding.codeNodes,
      newUnderstanding.codeNodes,
    );

    // Compare patterns
    const patternChanges = this.comparePatterns(
      oldUnderstanding.patterns,
      newUnderstanding.patterns
    );

    // Compare relationships
    const relationshipChanges = this.compareRelationships(
      oldUnderstanding.relationships,
      newUnderstanding.relationships
    );

    // Compare semantic structures
    const semanticChanges = this.compareSemanticStructures(
      oldUnderstanding.concepts,
      oldUnderstanding.semanticUnits,
      newUnderstanding.concepts,
      newUnderstanding.semanticUnits
    );

    return {
      fileSystemChanges,
      codeStructureChanges,
      patternChanges,
      relationshipChanges,
      semanticChanges,
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
   * Compare patterns to detect changes
   */
  private comparePatterns(
    oldPatterns: CodePattern[],
    newPatterns: CodePattern[],
  ): HashDiff {
    const result: HashDiff = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
    };

    // Map patterns by ID
    const oldPatternMap = new Map(oldPatterns.map(p => [p.id, p]));
    const newPatternMap = new Map(newPatterns.map(p => [p.id, p]));

    // Find added and modified patterns
    for (const [id, newPattern] of newPatternMap.entries()) {
      const oldPattern = oldPatternMap.get(id);

      if (!oldPattern) {
        // New pattern
        result.added.push(id);
      } else {
        // Compute hashes for comparison
        const oldHash = this.computePatternHash(oldPattern);
        const newHash = this.computePatternHash(newPattern);

        if (oldHash !== newHash) {
          // Modified pattern
          result.modified.push(id);
        } else {
          // Unchanged pattern
          result.unchanged.push(id);
        }
      }
    }

    // Find deleted patterns
    for (const [id] of oldPatternMap.entries()) {
      if (!newPatternMap.has(id)) {
        result.deleted.push(id);
      }
    }

    return result;
  }

  /**
   * Compare relationships to detect changes
   */
  private compareRelationships(
    oldRelationships: Relationship[],
    newRelationships: Relationship[],
  ): HashDiff {
    const result: HashDiff = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
    };

    // Map relationships by ID
    const oldRelMap = new Map(oldRelationships.map(r => [r.id, r]));
    const newRelMap = new Map(newRelationships.map(r => [r.id, r]));

    // Find added and modified relationships
    for (const [id, newRel] of newRelMap.entries()) {
      const oldRel = oldRelMap.get(id);

      if (!oldRel) {
        // New relationship
        result.added.push(id);
      } else {
        // Compute hashes for comparison
        const oldHash = this.computeRelationshipHash(oldRel);
        const newHash = this.computeRelationshipHash(newRel);

        if (oldHash !== newHash) {
          // Modified relationship
          result.modified.push(id);
        } else {
          // Unchanged relationship
          result.unchanged.push(id);
        }
      }
    }

    // Find deleted relationships
    for (const [id] of oldRelMap.entries()) {
      if (!newRelMap.has(id)) {
        result.deleted.push(id);
      }
    }

    return result;
  }

  /**
   * Compare semantic structures to detect changes
   */
  private compareSemanticStructures(
    oldConcepts: Concept[],
    oldUnits: SemanticUnit[],
    newConcepts: Concept[],
    newUnits: SemanticUnit[],
  ): HashDiff {
    const result: HashDiff = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
    };

    // Compare concepts
    const oldConceptMap = new Map(oldConcepts.map(c => [c.id, c]));
    const newConceptMap = new Map(newConcepts.map(c => [c.id, c]));

    // Find added and modified concepts
    for (const [id, newConcept] of newConceptMap.entries()) {
      const oldConcept = oldConceptMap.get(id);

      if (!oldConcept) {
        // New concept
        result.added.push(`concept:${id}`);
      } else {
        // Compute hashes for comparison
        const oldHash = this.computeConceptHash(oldConcept);
        const newHash = this.computeConceptHash(newConcept);

        if (oldHash !== newHash) {
          // Modified concept
          result.modified.push(`concept:${id}`);
        } else {
          // Unchanged concept
          result.unchanged.push(`concept:${id}`);
        }
      }
    }

    // Find deleted concepts
    for (const [id] of oldConceptMap.entries()) {
      if (!newConceptMap.has(id)) {
        result.deleted.push(`concept:${id}`);
      }
    }

    // Compare semantic units
    const oldUnitMap = new Map(oldUnits.map(u => [u.id, u]));
    const newUnitMap = new Map(newUnits.map(u => [u.id, u]));

    // Find added and modified units
    for (const [id, newUnit] of newUnitMap.entries()) {
      const oldUnit = oldUnitMap.get(id);

      if (!oldUnit) {
        // New unit
        result.added.push(`unit:${id}`);
      } else {
        // Compute hashes for comparison
        const oldHash = this.computeSemanticUnitHash(oldUnit);
        const newHash = this.computeSemanticUnitHash(newUnit);

        if (oldHash !== newHash) {
          // Modified unit
          result.modified.push(`unit:${id}`);
        } else {
          // Unchanged unit
          result.unchanged.push(`unit:${id}`);
        }
      }
    }

    // Find deleted units
    for (const [id] of oldUnitMap.entries()) {
      if (!newUnitMap.has(id)) {
        result.deleted.push(`unit:${id}`);
      }
    }

    return result;
  }

  /**
   * Map nodes by path
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
   * Calculate which analyzers need to be run based on changes
   */
  calculateAnalyzersToRun(
    changes: {
      fileSystemChanges: HashDiff;
      codeStructureChanges: HashDiff;
      patternChanges: HashDiff;
      relationshipChanges: HashDiff;
      semanticChanges: HashDiff;
    }
  ): string[] {
    const analyzersToRun: Set<string> = new Set();
    
    // Simple rules for now:
    
    // If file system changes, run language detector and all subsequent analyzers
    if (changes.fileSystemChanges.added.length > 0 || 
        changes.fileSystemChanges.modified.length > 0 || 
        changes.fileSystemChanges.deleted.length > 0) {
      analyzersToRun.add('LanguageDetectorAnalyzer');
      analyzersToRun.add('RelationshipAnalyzer');
      analyzersToRun.add('PatternAnalyzer');
      analyzersToRun.add('DependencyAnalyzer');
      analyzersToRun.add('DataFlowAnalyzer');
      analyzersToRun.add('SemanticAnalyzer');
      analyzersToRun.add('ClusteringAnalyzer');
    }
    
    // If only code structure changes but no file changes, start from relationship analysis
    else if (changes.codeStructureChanges.added.length > 0 || 
             changes.codeStructureChanges.modified.length > 0 || 
             changes.codeStructureChanges.deleted.length > 0) {
      analyzersToRun.add('RelationshipAnalyzer');
      analyzersToRun.add('PatternAnalyzer');
      analyzersToRun.add('DependencyAnalyzer');
      analyzersToRun.add('DataFlowAnalyzer');
      analyzersToRun.add('SemanticAnalyzer');
      analyzersToRun.add('ClusteringAnalyzer');
    }
    
    // If only pattern or relationship changes, recalculate semantic and clustering
    else if ((changes.patternChanges.added.length > 0 || 
              changes.patternChanges.modified.length > 0 || 
              changes.patternChanges.deleted.length > 0) ||
             (changes.relationshipChanges.added.length > 0 || 
              changes.relationshipChanges.modified.length > 0 || 
              changes.relationshipChanges.deleted.length > 0)) {
      analyzersToRun.add('SemanticAnalyzer');
      analyzersToRun.add('ClusteringAnalyzer');
    }
    
    // If only semantic changes, just recalculate clustering
    else if (changes.semanticChanges.added.length > 0 || 
             changes.semanticChanges.modified.length > 0 || 
             changes.semanticChanges.deleted.length > 0) {
      analyzersToRun.add('ClusteringAnalyzer');
    }
    
    return Array.from(analyzersToRun);
  }

  /**
   * Perform incremental update of codebase understanding
   */
  prepareIncrementalUpdate(
    oldUnderstanding: UnifiedCodebaseUnderstanding,
    changes: {
      fileSystemChanges: HashDiff;
      codeStructureChanges: HashDiff;
      patternChanges: HashDiff;
      relationshipChanges: HashDiff;
      semanticChanges: HashDiff;
    }
  ): {
    analyzersToRun: string[];
    modifiedFiles: string[];
    addedFiles: string[];
    deletedFiles: string[];
  } {
    // Determine which analyzers need to run
    const analyzersToRun = this.calculateAnalyzersToRun(changes);
    
    // Extract file changes for direct analysis
    const modifiedFiles = changes.fileSystemChanges.modified;
    const addedFiles = changes.fileSystemChanges.added;
    const deletedFiles = changes.fileSystemChanges.deleted;
    
    return {
      analyzersToRun,
      modifiedFiles,
      addedFiles,
      deletedFiles
    };
  }
}