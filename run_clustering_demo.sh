#!/bin/bash

# Script to run the clustering demo

echo "Compiling TypeScript..."
bun build source/services/indexing/emergentIndexing/demos/clusteringDemo.ts --outdir dist

echo "Running clustering demo on current project..."
node dist/clusteringDemo.js