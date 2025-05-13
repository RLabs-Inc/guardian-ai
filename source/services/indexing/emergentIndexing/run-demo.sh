#!/bin/bash

# Run the emergent indexing demo

# Default to current directory if no argument is provided
PROJECT_PATH=${1:-$(pwd)}

# Compile TypeScript
echo "Compiling TypeScript..."
cd "$(dirname "$0")/../../../.."
bun build

# Run the demo
echo "Running emergent indexing demo on $PROJECT_PATH..."
bun run ./source/services/indexing/emergentIndexing/demo.ts "$PROJECT_PATH"