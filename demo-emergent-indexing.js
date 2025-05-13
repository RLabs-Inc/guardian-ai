#!/usr/bin/env node

/**
 * Demo script for running the emergent indexing system
 */
import { runEmergentIndexingDemo } from './source/services/indexing/emergentIndexing/demo.js';

// Get the target codebase path from command-line arguments, or default to current directory
const projectPath = process.argv[2] || process.cwd();

// Run the demo
try {
  console.log(`Running emergent indexing demo on ${projectPath}`);
  runEmergentIndexingDemo(projectPath);
} catch (error) {
  console.error('Failed to run demo:', error);
  process.exit(1);
}