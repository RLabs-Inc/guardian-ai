#!/bin/bash

# Data Flow Analysis Demo Runner
# This script demonstrates the data flow analysis capability of the emergent indexing system.

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../../.." && pwd)"

# Parse arguments
TARGET_DIR="${1:-$PROJECT_ROOT}"
OUTPUT_FILE="${2:-${PROJECT_ROOT}/.guardian/data-flow-results.json}"

# Set up necessary directories
mkdir -p "${PROJECT_ROOT}/.guardian"

# Display information
echo "========================================================"
echo "Data Flow Analysis Demo"
echo "========================================================"
echo "Project Root: ${PROJECT_ROOT}"
echo "Target Directory: ${TARGET_DIR}"
echo "Output File: ${OUTPUT_FILE}"
echo "========================================================"

# Run the demo script using bun (or node if bun is not available)
if command -v bun &> /dev/null; then
    echo "Running with Bun runtime..."
    cd "${PROJECT_ROOT}" && bun run --no-install "${SCRIPT_DIR}/demos/dataFlowDemo.ts" "${TARGET_DIR}" "${OUTPUT_FILE}"
elif command -v node &> /dev/null; then
    echo "Running with Node runtime..."
    cd "${PROJECT_ROOT}" && node --loader ts-node/esm "${SCRIPT_DIR}/demos/dataFlowDemo.ts" "${TARGET_DIR}" "${OUTPUT_FILE}"
else
    echo "Error: Neither Bun nor Node.js is available. Please install one of them to run the demo."
    exit 1
fi

# Display completion message
echo "========================================================"
echo "Data Flow Analysis Demo Complete"
echo "Results saved to: ${OUTPUT_FILE}"
echo "========================================================"