/**
 * Relationship Detector for identifying connections between code symbols
 */

import { IndexNode, IndexNodeType, IndexRelationship, RelationshipType } from './types.js';

export class RelationshipDetector {
  /**
   * Detect relationships between nodes in the index
   * @param nodes Flat array of index nodes
   */
  detectRelationships(nodes: IndexNode[]): IndexRelationship[] {
    const relationships: IndexRelationship[] = [];
    
    // Create a map for quick lookup
    const nodeMap: Map<string, IndexNode> = new Map();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }
    
    // Process nodes to identify relationships
    for (const sourceNode of nodes) {
      // Skip non-code nodes (files, directories, projects)
      if (
        sourceNode.type === IndexNodeType.PROJECT ||
        sourceNode.type === IndexNodeType.DIRECTORY
      ) {
        continue;
      }
      
      // Detect relationships based on node type
      switch (sourceNode.type) {
        case IndexNodeType.FILE:
          this.detectFileRelationships(sourceNode, nodes, relationships);
          break;
        
        case IndexNodeType.CLASS:
          this.detectClassRelationships(sourceNode, nodes, relationships);
          break;
        
        case IndexNodeType.FUNCTION:
        case IndexNodeType.METHOD:
          this.detectFunctionRelationships(sourceNode, nodes, relationships);
          break;
        
        case IndexNodeType.INTERFACE:
          this.detectInterfaceRelationships(sourceNode, nodes, relationships);
          break;
        
        case IndexNodeType.IMPORT:
          this.detectImportRelationships(sourceNode, nodes, relationships);
          break;
        
        case IndexNodeType.EXPORT:
          this.detectExportRelationships(sourceNode, nodes, relationships);
          break;
      }
    }
    
    // Detect parent-child relationships last
    this.detectContainmentRelationships(nodes, relationships);
    
    return relationships;
  }
  
  /**
   * Detect file-level relationships (imports, requires)
   * @private
   */
  private detectFileRelationships(
    fileNode: IndexNode,
    allNodes: IndexNode[],
    relationships: IndexRelationship[]
  ): void {
    // Find import declarations in this file
    const importNodes = allNodes.filter(node =>
      node.type === IndexNodeType.IMPORT && node.parent?.id === fileNode.id
    );

    // Find files that correspond to imported modules
    for (const importNode of importNodes) {
      const importSource = importNode.metadata?.['source'];
      if (importSource) {
        // Look for files that match the import path
        const targetFiles = allNodes.filter(node =>
          node.type === IndexNodeType.FILE &&
          (node.path.includes(importSource) ||
           node.name === importSource ||
           node.name === `${importSource}.js` ||
           node.name === `${importSource}.ts`)
        );

        // Create a relationship for each matching file
        for (const targetFile of targetFiles) {
          relationships.push({
            type: RelationshipType.IMPORTS,
            sourceId: fileNode.id,
            targetId: targetFile.id,
            metadata: {
              importName: importNode.name,
              importNode: importNode.id
            }
          });
        }
      }
    }
  }
  
  /**
   * Detect class relationships (extends, implements)
   * @private
   */
  private detectClassRelationships(
    classNode: IndexNode,
    allNodes: IndexNode[],
    relationships: IndexRelationship[]
  ): void {
    const extendedClass = classNode.metadata?.['extends'];
    const implementedInterfaces = classNode.metadata?.['implements'] || [];

    // Find extended class
    if (extendedClass) {
      const parentClasses = allNodes.filter(node =>
        node.type === IndexNodeType.CLASS && node.name === extendedClass
      );

      // Create inheritance relationships
      for (const parentClass of parentClasses) {
        relationships.push({
          type: RelationshipType.EXTENDS,
          sourceId: classNode.id,
          targetId: parentClass.id
        });
      }
    }
    
    // Find implemented interfaces
    for (const interfaceName of implementedInterfaces) {
      const interfaces = allNodes.filter(node => 
        node.type === IndexNodeType.INTERFACE && node.name === interfaceName
      );
      
      // Create implementation relationships
      for (const interfaceNode of interfaces) {
        relationships.push({
          type: RelationshipType.IMPLEMENTS,
          sourceId: classNode.id,
          targetId: interfaceNode.id
        });
      }
    }
  }
  
  /**
   * Detect function/method relationships (calls)
   * @private
   */
  private detectFunctionRelationships(
    functionNode: IndexNode,
    allNodes: IndexNode[],
    relationships: IndexRelationship[]
  ): void {
    // This is a simplified approach; in a production system,
    // you'd want to do more sophisticated analysis
    
    if (typeof functionNode.content !== 'string') {
      return;
    }
    
    // Look for function calls based on function names
    for (const node of allNodes) {
      if (
        (node.type === IndexNodeType.FUNCTION || node.type === IndexNodeType.METHOD) &&
        node.id !== functionNode.id && // Don't match self
        node.name.length > 2 && // Avoid very short names that could be common
        functionNode.content.includes(`${node.name}(`)
      ) {
        // Potential function call found
        relationships.push({
          type: RelationshipType.CALLS,
          sourceId: functionNode.id,
          targetId: node.id,
          metadata: {
            confidence: 'medium' // This is a simplified analysis
          }
        });
      }
    }
  }
  
  /**
   * Detect interface relationships
   * @private
   */
  private detectInterfaceRelationships(
    interfaceNode: IndexNode,
    allNodes: IndexNode[],
    relationships: IndexRelationship[]
  ): void {
    // Find classes that implement this interface
    const implementingClasses = allNodes.filter(node =>
      node.type === IndexNodeType.CLASS &&
      node.metadata?.['implements']?.includes(interfaceNode.name)
    );
    
    // Create implementation relationships
    for (const classNode of implementingClasses) {
      relationships.push({
        type: RelationshipType.IMPLEMENTS,
        sourceId: classNode.id,
        targetId: interfaceNode.id
      });
    }
    
    // Look for interface extension
    const extendedInterface = interfaceNode.metadata?.['extends'];
    if (extendedInterface) {
      const parentInterfaces = allNodes.filter(node =>
        node.type === IndexNodeType.INTERFACE && node.name === extendedInterface
      );
      
      // Create extension relationships
      for (const parentInterface of parentInterfaces) {
        relationships.push({
          type: RelationshipType.EXTENDS,
          sourceId: interfaceNode.id,
          targetId: parentInterface.id
        });
      }
    }
  }
  
  /**
   * Detect import relationships
   * @private
   */
  private detectImportRelationships(
    _importNode: IndexNode,
    _allNodes: IndexNode[],
    _relationships: IndexRelationship[]
  ): void {
    // Import relationships are primarily handled in detectFileRelationships
    // This method could be extended for more specific import analysis
  }
  
  /**
   * Detect export relationships
   * @private
   */
  private detectExportRelationships(
    exportNode: IndexNode,
    allNodes: IndexNode[],
    relationships: IndexRelationship[]
  ): void {
    // Find the file this export belongs to
    const fileNode = allNodes.find(node => 
      node.id === exportNode.parent?.id && node.type === IndexNodeType.FILE
    );
    
    if (!fileNode) {
      return;
    }
    
    // Find symbols that are exported
    const exportedSymbolNames = exportNode.metadata?.['exportedSymbols'] || [];
    if (exportedSymbolNames.length > 0) {
      // Look for symbols with these names in the same file
      for (const symbolName of exportedSymbolNames) {
        const symbols = allNodes.filter(node => 
          node.name === symbolName && 
          node.parent?.id === fileNode.id
        );
        
        // Create export relationships
        for (const symbol of symbols) {
          relationships.push({
            type: RelationshipType.DEFINES, // Using DEFINES since EXPORTS doesn't exist in the enum
            sourceId: fileNode.id,
            targetId: symbol.id,
            metadata: {
              exportNode: exportNode.id,
              isExport: true // Adding this flag to indicate it's an export relationship
            }
          });
        }
      }
    }
  }
  
  /**
   * Detect containment relationships (parent-child)
   * @private
   */
  private detectContainmentRelationships(
    nodes: IndexNode[],
    relationships: IndexRelationship[]
  ): void {
    // Create CONTAINS relationships for all parent-child links
    for (const node of nodes) {
      if (node.children?.length) {
        for (const child of node.children) {
          relationships.push({
            type: RelationshipType.CONTAINS,
            sourceId: node.id,
            targetId: child.id
          });
        }
      }
    }
  }
}