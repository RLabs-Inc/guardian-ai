#!/usr/bin/env bun

/**
 * Script to download WebAssembly versions of Tree-sitter language parsers
 * This script downloads the necessary .wasm files for the languages we want to support
 */

import fs from 'fs';
import path from 'path';
import { fetch } from 'undici';

// Directory where the WASM parsers will be stored
const wasmDir = path.resolve('./source/tree-sitter-wasm');

// Ensure the directory exists
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
}

// Define the languages we want to support
const languages = [
  'javascript',
  'typescript',
  'python',
  'go',
  'bash',
  'c',
  'cpp',
  'html',
  'css',
  'java',
  'ruby',
  'rust',
  'json',
  'yaml',
  'php'
];

// CDN URL where Tree-sitter WASM files are hosted
// This is using the CDN for web-tree-sitter releases
const cdnBaseUrl = 'https://unpkg.com/web-tree-sitter@0.25.3/tree-sitter';

// Function to download a wasm file for a specific language
async function downloadWasmParser(language) {
  const fileName = `tree-sitter-${language}.wasm`;
  const fileUrl = `${cdnBaseUrl}/${fileName}`;
  const filePath = path.join(wasmDir, fileName);
  
  console.log(`Downloading ${fileName}...`);
  
  try {
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${language} parser: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    
    console.log(`✅ Successfully downloaded ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error downloading ${language} parser:`, error.message);
    return false;
  }
}

// Alternative sources for parsers that might not be available in the CDN
const alternativeSources = {
  // Add any alternative sources here if needed
  // Example: 'language': 'https://alternative-url/tree-sitter-language.wasm'
};

// Main function to download all parsers
async function downloadAllParsers() {
  console.log('Starting download of Tree-sitter WASM parsers...');
  
  const results = await Promise.all(
    languages.map(async (language) => {
      const success = await downloadWasmParser(language);
      
      // Try alternative source if available and primary source failed
      if (!success && alternativeSources[language]) {
        console.log(`Trying alternative source for ${language}...`);
        // Implementation for alternative source download would go here
      }
      
      return { language, success };
    })
  );
  
  // Summary
  console.log('\n=== Download Summary ===');
  const successful = results.filter(r => r.success).map(r => r.language);
  const failed = results.filter(r => !r.success).map(r => r.language);
  
  console.log(`✅ Successfully downloaded: ${successful.length} parsers`);
  if (successful.length > 0) {
    console.log(`   - ${successful.join(', ')}`);
  }
  
  console.log(`❌ Failed to download: ${failed.length} parsers`);
  if (failed.length > 0) {
    console.log(`   - ${failed.join(', ')}`);
  }
  
  console.log('\nWASM parsers are stored in:', wasmDir);
}

// Run the download
downloadAllParsers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});