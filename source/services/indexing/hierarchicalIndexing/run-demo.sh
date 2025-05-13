#!/bin/bash

# Compile TypeScript files
echo "Compiling..."
cd /Users/rusty/Documents/Projects/AI/Tools/GuardianAI
bun build source/services/indexing/hierarchicalIndexing/runDemo.ts --outdir dist/demo

# Run the demo
echo "Running demo..."
node dist/demo/runDemo.js "$@"