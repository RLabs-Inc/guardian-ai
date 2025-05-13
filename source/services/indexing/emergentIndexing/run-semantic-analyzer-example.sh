#!/bin/bash

# Run the semantic analyzer example

# Ensure we're in the project root
cd "$(dirname "$0")/../../../.." || { echo "Failed to change to project root directory"; exit 1; }

# Check if the script is being run with Bun or Node
if command -v bun &> /dev/null; then
  echo "Running with Bun..."
  bun run ./source/services/indexing/emergentIndexing/examples/semanticAnalyzerRunner.ts
elif command -v node &> /dev/null; then
  echo "Running with Node..."
  node --loader ts-node/esm ./source/services/indexing/emergentIndexing/examples/semanticAnalyzerRunner.ts
else
  echo "Neither Bun nor Node.js is installed or accessible."
  exit 1
fi