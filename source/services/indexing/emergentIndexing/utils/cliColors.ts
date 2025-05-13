/**
 * CLI Colors
 * 
 * A simple utility for adding colors to CLI output in the demos,
 * based on the GuardianAI theming system.
 */

import { Concept, SemanticUnit, CodebaseUnderstanding } from '../types.js';

// Using colors based on GuardianAI's theme system

// Terminal colors for CLI output
export const colors = {
  // Theme colors
  primary: '\x1b[34m', // blue (from TerminalDefaultTheme)
  secondary: '\x1b[36m', // cyan
  success: '\x1b[32m', // green
  error: '\x1b[31m', // red
  warning: '\x1b[33m', // yellow
  info: '\x1b[34m', // blue
  dimText: '\x1b[90m', // gray
  text: '\x1b[37m', // white
  
  // Reset
  reset: '\x1b[0m',
  
  // Text styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m'
};

/**
 * Format text with a specific color
 */
export function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Format text as bold
 */
export function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

/**
 * Format text with bold and color
 */
export function boldColorize(text: string, color: keyof typeof colors): string {
  return `${colors.bold}${colors[color]}${text}${colors.reset}`;
}

/**
 * Print a separator line
 */
export function printSeparator(title: string, color: keyof typeof colors = 'primary'): void {
  const separator = '='.repeat(80);
  console.log();
  console.log(boldColorize(separator, color));
  
  // Center the title
  const padding = Math.max(0, Math.floor((80 - title.length) / 2));
  const centeredTitle = ' '.repeat(padding) + title + ' '.repeat(padding);
  
  console.log(boldColorize(centeredTitle, color));
  console.log(boldColorize(separator, color));
  console.log();
}

/**
 * Print a section title
 */
export function printSection(title: string, color: keyof typeof colors = 'secondary'): void {
  console.log();
  console.log(boldColorize(title, color));
  console.log(colorize('-'.repeat(title.length), color));
}

/**
 * Print a header (smaller than a section)
 */
export function printHeader(title: string, color: keyof typeof colors = 'primary'): void {
  console.log();
  console.log(boldColorize(title, color));
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(colorize(`✓ ${message}`, 'success'));
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.log(colorize(`✗ ${message}`, 'error'));
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.log(colorize(`! ${message}`, 'warning'));
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  console.log(colorize(`ℹ ${message}`, 'info'));
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: any): void {
  console.log(`${colorize(key + ':', 'dimText')} ${value}`);
}

/**
 * Print a list item
 */
export function printListItem(text: string, indentLevel: number = 0): void {
  const indent = '  '.repeat(indentLevel);
  console.log(`${indent}${colorize('-', 'secondary')} ${text}`);
}

/**
 * Print a concept with its details
 */
export function printConcept(
  concept: Concept, 
  index: number, 
  understanding: CodebaseUnderstanding
): void {
  console.log();
  console.log(
    `${colorize(`#${index}`, 'dimText')} ${boldColorize(concept.name, 'primary')} ` +
    `(${colorize(`${Math.round(concept.confidence * 100)}%`, 'success')})`
  );
  
  console.log(colorize(concept.description, 'text'));
  
  // Show the number of code elements
  const elementsCount = concept.codeElements.length;
  console.log(colorize(`Found in ${elementsCount} code ${elementsCount === 1 ? 'element' : 'elements'}`, 'dimText'));
  
  // Optionally show a sample of code elements
  if (elementsCount > 0 && elementsCount <= 5) {
    console.log(colorize('Elements:', 'dimText'));
    for (const nodeId of concept.codeElements.slice(0, 3)) {
      const node = understanding.codeNodes.get(nodeId);
      if (node) {
        console.log(colorize(`  - ${node.name}${node.path ? ` (${node.path})` : ''}`, 'dimText'));
      }
    }
  } else if (elementsCount > 5) {
    console.log(colorize('Elements include:', 'dimText'));
    for (const nodeId of concept.codeElements.slice(0, 3)) {
      const node = understanding.codeNodes.get(nodeId);
      if (node) {
        console.log(colorize(`  - ${node.name}${node.path ? ` (${node.path})` : ''}`, 'dimText'));
      }
    }
    console.log(colorize(`  ... and ${elementsCount - 3} more`, 'dimText'));
  }
  
  // Show related concepts
  if (concept.relatedConcepts && concept.relatedConcepts.length > 0) {
    console.log(colorize('Related to:', 'dimText'));
    for (const relatedId of concept.relatedConcepts.slice(0, 3)) {
      const related = understanding.concepts.find(c => c.id === relatedId);
      if (related) {
        console.log(colorize(`  - ${related.name}`, 'dimText'));
      }
    }
    
    if (concept.relatedConcepts.length > 3) {
      console.log(colorize(`  ... and ${concept.relatedConcepts.length - 3} more`, 'dimText'));
    }
  }
}

/**
 * Print a semantic unit with its details
 */
export function printSemanticUnit(
  unit: SemanticUnit, 
  index: number, 
  understanding: CodebaseUnderstanding
): void {
  console.log();
  console.log(
    `${colorize(`#${index}`, 'dimText')} ${boldColorize(unit.name, 'secondary')} ` +
    `(${colorize(`${Math.round(unit.confidence * 100)}%`, 'success')})`
  );
  
  console.log(colorize(unit.description, 'text'));
  console.log(colorize(`Type: ${unit.type}`, 'dimText'));
  
  // Show the number of code elements
  const elementsCount = unit.codeNodeIds.length;
  console.log(colorize(`Contains ${elementsCount} code ${elementsCount === 1 ? 'element' : 'elements'}`, 'dimText'));
  
  // Show associated concepts
  if (unit.concepts && unit.concepts.length > 0) {
    console.log(colorize('Associated concepts:', 'dimText'));
    for (const conceptId of unit.concepts.slice(0, 3)) {
      const concept = understanding.concepts.find(c => c.id === conceptId);
      if (concept) {
        console.log(colorize(`  - ${concept.name}`, 'dimText'));
      }
    }
    
    if (unit.concepts.length > 3) {
      console.log(colorize(`  ... and ${unit.concepts.length - 3} more`, 'dimText'));
    }
  }
  
  // Show semantic properties if they exist
  if (unit.semanticProperties) {
    const props = Object.entries(unit.semanticProperties);
    if (props.length > 0) {
      console.log(colorize('Properties:', 'dimText'));
      for (const [key, value] of props.slice(0, 3)) {
        console.log(colorize(`  - ${key}: ${value}`, 'dimText'));
      }
      
      if (props.length > 3) {
        console.log(colorize(`  ... and ${props.length - 3} more`, 'dimText'));
      }
    }
  }
}

/**
 * Print side-by-side comparison
 */
export function printComparison(
  label: string, 
  standardValue: any, 
  enhancedValue: any
): void {
  console.log(
    `${colorize(label + ':', 'dimText')} ` +
    `${colorize('Standard:', 'primary')} ${standardValue} | ` +
    `${colorize('Enhanced:', 'secondary')} ${enhancedValue}`
  );
}

/**
 * Print concept comparison
 */
export function printConceptComparison(
  label: string,
  standardConcepts: Concept[],
  enhancedConcepts: Concept[]
): void {
  console.log();
  console.log(boldColorize(label, 'primary'));
  
  const maxCount = Math.max(standardConcepts.length, enhancedConcepts.length);
  
  for (let i = 0; i < maxCount; i++) {
    const standardConcept = standardConcepts[i];
    const enhancedConcept = enhancedConcepts[i];
    
    const standardText = standardConcept 
      ? `${standardConcept.name} (${Math.round(standardConcept.confidence * 100)}%)`
      : '';
    
    const enhancedText = enhancedConcept 
      ? `${enhancedConcept.name} (${Math.round(enhancedConcept.confidence * 100)}%)`
      : '';
    
    console.log(
      `${colorize(`#${i+1}:`, 'dimText')} ` +
      `${colorize('Standard:', 'primary')} ${standardText.padEnd(30)} ` +
      `${colorize('Enhanced:', 'secondary')} ${enhancedText}`
    );
  }
}