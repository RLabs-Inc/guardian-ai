#!/bin/bash

# Run the enhanced semantic analyzer demo
# This shell script runs the enhanced semantic analyzer demo

# Navigate to script directory
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Running Enhanced Semantic Analyzer Demo${NC}"
echo "=================================================="
echo ""

# Parse arguments
TARGET_DIR="${1:-../../}"
MAX_DEPTH="${2:-4}"

# Run the demo using Node.js
node --experimental-modules --es-module-specifier-resolution=node demos/enhancedSemanticDemo.js "$TARGET_DIR" "$MAX_DEPTH"

echo ""
echo -e "${GREEN}Demo completed!${NC}"