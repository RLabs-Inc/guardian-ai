#!/bin/bash

# Emergent Indexing System - TypeScript Demos Runner
# This script runs all the emergent indexing demos using the TypeScript controller

# Terminal colors - matching GuardianAI theme system
PRIMARY='\033[0;34m' # blue (primary color from theme)
SECONDARY='\033[0;36m' # cyan (secondary color from theme)
SUCCESS='\033[0;32m' # green
ERROR='\033[0;31m' # red
WARNING='\033[0;33m' # yellow
INFO='\033[0;34m' # blue
DIM='\033[0;90m' # gray
TEXT='\033[0;37m' # white
BOLD='\033[1m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

# Default target directory is the GuardianAI project itself
DEFAULT_TARGET="${PROJECT_ROOT}"

# Parse arguments
TARGET_DIR="${1:-$DEFAULT_TARGET}"
OUTPUT_DIR="${TARGET_DIR}/.guardian/emergent"

# Create output directory if it doesn't exist
mkdir -p "${OUTPUT_DIR}"

# Print banner
echo -e "\n${PRIMARY}${BOLD}=======================================================================${NC}"
echo -e "${PRIMARY}${BOLD}            EMERGENT INDEXING SYSTEM - TYPESCRIPT DEMOS             ${NC}"
echo -e "${PRIMARY}${BOLD}=======================================================================${NC}"
echo -e "${SECONDARY}Target Directory: ${NC}${TARGET_DIR}"
echo -e "${SECONDARY}Output Directory: ${NC}${OUTPUT_DIR}"
echo -e "${PRIMARY}${BOLD}=======================================================================${NC}\n"

# Detect runtime
if command -v bun &> /dev/null; then
    echo -e "${SECONDARY}Using Bun runtime...${NC}"
    cd "${PROJECT_ROOT}" && bun run --no-install "${SCRIPT_DIR}/allDemosRunner.ts" "${TARGET_DIR}"
elif command -v node &> /dev/null; then
    echo -e "${SECONDARY}Using Node runtime...${NC}"
    cd "${PROJECT_ROOT}" && node --loader ts-node/esm "${SCRIPT_DIR}/allDemosRunner.ts" "${TARGET_DIR}"
else
    echo -e "${ERROR}Error: Neither Bun nor Node.js is available. Please install one of them to run the demos.${NC}"
    exit 1
fi

# Check if demos were successful
if [ $? -eq 0 ]; then
    echo -e "\n${SUCCESS}${BOLD}✓ All demos completed successfully!${NC}\n"
    # List all generated files
    echo -e "${SECONDARY}Generated files:${NC}"
    find "${OUTPUT_DIR}" -type f -name "*.json" | while read -r file; do
        FILE_SIZE=$(du -h "$file" | cut -f1)
        echo -e "  - ${WARNING}$(basename "$file")${NC} (${FILE_SIZE})"
    done
    echo -e "\n${PRIMARY}${BOLD}Results are saved in: ${OUTPUT_DIR}${NC}\n"
    exit 0
else
    echo -e "\n${ERROR}${BOLD}✗ Some demos failed. Check the logs for details.${NC}\n"
    exit 1
fi
