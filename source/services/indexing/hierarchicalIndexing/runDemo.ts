/**
 * Demo script for running the hierarchical indexing on a codebase
 */

import path from 'path';
import { NodeFileSystemService } from '../../fileSystem/fileSystemService.js';
import { FileSystemService } from '../../fileSystem/types.js';
import { indexProjectExample } from './example.js';

// Create output directory in advance
import fs from 'fs';
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Get the project path from command line arguments
const projectPath = process.argv[2] || process.cwd();
const absolutePath = path.resolve(projectPath);

console.log(`========================================`);
console.log(`Hierarchical Indexing System Demo`);
console.log(`========================================`);
console.log(`Target codebase: ${absolutePath}`);
console.log(`Starting demo...`);
console.log(`----------------------------------------`);

// Create file system service
const fileSystem: FileSystemService = new NodeFileSystemService();

// Create output directory
const outputDir = path.join(absolutePath, '.guardian');
ensureDirectoryExists(outputDir);
console.log(`Output directory: ${outputDir}`);

// Run the example
indexProjectExample(fileSystem, absolutePath)
  .then(() => {
    console.log(`----------------------------------------`);
    console.log(`Demo completed successfully!`);
    console.log(`Index is saved in the .guardian directory of your project.`);
    console.log(`========================================`);
  })
  .catch(error => {
    console.error(`Error running demo:`, error);
    process.exit(1);
  });