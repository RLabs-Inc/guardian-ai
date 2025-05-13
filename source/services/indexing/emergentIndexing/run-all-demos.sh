#!/bin/bash

# Emergent Indexing System - All Features Demo
# This script runs all the emergent indexing demos and tests in sequence

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
print_banner() {
    echo -e "\n${PRIMARY}${BOLD}=======================================================================${NC}"
    echo -e "${PRIMARY}${BOLD}                  EMERGENT INDEXING SYSTEM DEMO                      ${NC}"
    echo -e "${PRIMARY}${BOLD}=======================================================================${NC}"
    echo -e "${SECONDARY}Target Directory: ${NC}${TARGET_DIR}"
    echo -e "${SECONDARY}Output Directory: ${NC}${OUTPUT_DIR}"
    echo -e "${PRIMARY}${BOLD}=======================================================================${NC}\n"
}

# Print section header
print_section() {
    echo -e "\n${SECONDARY}${BOLD}=======================================================================${NC}"
    echo -e "${SECONDARY}${BOLD}                          $1                          ${NC}"
    echo -e "${SECONDARY}${BOLD}=======================================================================${NC}\n"
}

# Run a demo with proper error handling
run_demo() {
    DEMO_NAME="$1"
    DEMO_SCRIPT="$2"
    DEMO_ARGS="${@:3}"

    print_section "$DEMO_NAME"
    echo -e "${INFO}Running $DEMO_NAME...${NC}\n"

    if command -v bun &> /dev/null; then
        echo -e "${SECONDARY}Using Bun runtime...${NC}"
        cd "${PROJECT_ROOT}" && bun run --no-install "${DEMO_SCRIPT}" ${DEMO_ARGS}
    elif command -v node &> /dev/null; then
        echo -e "${SECONDARY}Using Node runtime...${NC}"
        cd "${PROJECT_ROOT}" && node --loader ts-node/esm "${DEMO_SCRIPT}" ${DEMO_ARGS}
    else
        echo -e "${ERROR}Error: Neither Bun nor Node.js is available. Please install one of them to run the demo.${NC}"
        exit 1
    fi

    if [ $? -eq 0 ]; then
        echo -e "\n${SUCCESS}✓ $DEMO_NAME completed successfully${NC}\n"
    else
        echo -e "\n${ERROR}✗ $DEMO_NAME failed${NC}\n"
        # Continue with next demo instead of exiting
    fi
}

# Main function
main() {
    print_banner

    # 1. Basic Emergent Indexing Demo
    run_demo "Basic Emergent Indexing" "${SCRIPT_DIR}/demo.ts" "${TARGET_DIR}"

    # 2. Data Flow Analysis Demo
    run_demo "Data Flow Analysis" "${SCRIPT_DIR}/demos/dataFlowDemo.ts" "${TARGET_DIR}" "${OUTPUT_DIR}/data-flow-results.json"

    # 3. Code Clustering Demo
    run_demo "Code Clustering" "${SCRIPT_DIR}/demos/clusteringDemo.ts" "${TARGET_DIR}"

    # 4. Semantic Analysis Demo
    run_demo "Semantic Analysis" "${SCRIPT_DIR}/demos/semanticDemo.ts" "${TARGET_DIR}" "${OUTPUT_DIR}"

    # 5. Incremental Indexing Demo
    run_demo "Incremental Indexing" "${SCRIPT_DIR}/demos/incrementalDemo.ts" "${TARGET_DIR}" "${OUTPUT_DIR}"

    # Summary section
    print_section "SUMMARY"

    # List all generated files
    echo -e "${SECONDARY}Generated files:${NC}"
    find "${OUTPUT_DIR}" -type f -name "*.json" | while read -r file; do
        FILE_SIZE=$(du -h "$file" | cut -f1)
        echo -e "  - ${WARNING}$(basename "$file")${NC} (${FILE_SIZE})"
    done

    echo -e "\n${PRIMARY}${BOLD}All demos completed. Results are saved in: ${OUTPUT_DIR}${NC}\n"
}

# Run the main function
main
