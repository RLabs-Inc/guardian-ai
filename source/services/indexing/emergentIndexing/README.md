# Emergent Indexing System

An adaptive system for understanding codebases through organic discovery and zero assumptions.

## Overview

The Emergent Indexing System is designed to analyze and understand codebases without making assumptions about their structure, organization, or patterns. Instead, it discovers these elements through observation and pattern recognition, allowing it to adapt to any codebase regardless of language, framework, or conventions.

Core features:
- **Zero Assumptions**: No hardcoded expectations about code organization
- **Organic Discovery**: Let the codebase reveal its own structure and patterns
- **Evidence-Based Understanding**: Base all insights on direct evidence with confidence levels
- **Multi-dimensional Perspective**: View the code through multiple complementary lenses

## Demo Scripts

The system includes several demo scripts that showcase its capabilities:

### 1. Unified Demo Runners

These scripts run all demos in sequence:

- **run-all-demos.sh**: Bash script that runs all demos in sequence with colorful output
  ```bash
  ./run-all-demos.sh [target-directory]
  ```

- **run-ts-demos.sh**: TypeScript-based runner with more programmatic control
  ```bash
  ./run-ts-demos.sh [target-directory]
  ```

### 2. Individual Demo Scripts

Each feature has its own dedicated demo script:

- **run-demo.sh**: Basic emergent indexing demo
  ```bash
  ./run-demo.sh [target-directory]
  ```

- **run-dataflow-demo.sh**: Data flow analysis demo
  ```bash
  ./run-dataflow-demo.sh [target-directory] [output-file]
  ```

- **run-enhanced-semantic-demo.sh**: Enhanced semantic analysis demo
  ```bash
  ./run-enhanced-semantic-demo.sh [target-directory] [max-depth]
  ```

- **demos/semanticDemo.ts**: Standard semantic analysis demo
  ```bash
  # Run directly with Bun
  bun run demos/semanticDemo.ts [target-directory] [output-directory]
  # Or with Node.js
  node --loader ts-node/esm demos/semanticDemo.ts [target-directory] [output-directory]
  ```

- **demos/enhancedSemanticDemo.ts**: Enhanced semantic analysis demo with multi-dimensional concept extraction
  ```bash
  # Run directly with Bun
  bun run demos/enhancedSemanticDemo.ts [target-directory] [max-depth]
  # Or with Node.js
  node --loader ts-node/esm demos/enhancedSemanticDemo.ts [target-directory] [max-depth]
  ```

- **demos/incrementalDemo.ts**: Incremental indexing demo
  ```bash
  # Run directly with Bun
  bun run demos/incrementalDemo.ts [target-directory] [output-directory]
  # Or with Node.js
  node --loader ts-node/esm demos/incrementalDemo.ts [target-directory] [output-directory]
  ```

## Features

### Basic Indexing

The basic emergent indexing process analyzes a codebase and builds an understanding of:
- Language distribution
- Code structure
- Patterns and conventions
- Relationships between code elements
- Semantic concepts and units

### Data Flow Analysis

The data flow analyzer discovers:
- Data sources, sinks, transformers, and stores
- Data flows between components
- Function call parameters and return values
- Implicit data relationships
- Asynchronous and conditional flows
- Complete data flow paths through the system

### Code Clustering

The code clustering system finds natural groupings in the code:
- Elements with similar naming patterns
- Elements with similar structural characteristics
- Elements with similar relationship patterns
- Elements that work together on similar concepts

### Semantic Analysis

The system offers two semantic analyzers for extracting higher-level concepts from code:

#### Standard Semantic Analyzer
- Identifies key concepts in the codebase
- Groups related code elements into semantic units
- Discovers relationships between concepts
- Measures importance and confidence for identified concepts
- Builds a conceptual model of the codebase

#### Enhanced Semantic Analyzer
- Provides deeper, more nuanced understanding through multi-dimensional concept extraction:
  - **File/Module Level Extraction**: Discovers concepts from file and module names
  - **Identifier-Based Extraction**: Extracts concepts from functions, classes, and variables
  - **Documentation-Based Extraction**: Discovers concepts in comments and documentation
  - **Data Structure-Based Extraction**: Identifies concepts from classes, interfaces and types
- Creates richer semantic units using multiple techniques:
  - **Concept-Based Units**: Groups based on dominant concepts
  - **Pattern-Based Units**: Groups based on discovered code patterns
  - **Relationship-Based Units**: Groups based on tight coupling
  - **Directory-Based Units**: Groups with semantic coherence checks
- Builds more sophisticated concept relationships using:
  - Co-occurrence patterns
  - Semantic similarity
  - Structural relationships
  - Data flow connections
- Provides more dynamic, evidence-based confidence scores

### Incremental Indexing

The incremental indexing system efficiently updates understanding when code changes:
- Uses hash-based change detection to identify modified files
- Updates only affected parts of the understanding
- Preserves existing knowledge while incorporating new information
- Significantly improves performance for repeated analyses
- Maintains the consistency of the codebase understanding over time

## Output

All demos save their results in the `.guardian/emergent` directory within the target project. The main outputs are:

- **understanding.json**: The complete emergent understanding of the codebase
- **data-flow-results.json**: Results of the data flow analysis
- **understanding_with_clusters.json**: Understanding enhanced with code clusters
- **concepts.json**: Extracted concepts and semantic units from the codebase
- **initial-understanding.json**: Initial codebase understanding (from incremental demo)
- **updated-understanding.json**: Updated understanding after code changes (from incremental demo)

## Command Line Arguments

All scripts accept the following arguments:

1. `target-directory` (optional): The directory to analyze (defaults to GuardianAI project)
2. `output-file` (for dataflow demo): Path to save the data flow results

## Examples

```bash
# Run all demos on the GuardianAI project
./run-all-demos.sh

# Run all demos on a specific project
./run-all-demos.sh /path/to/your/project

# Run just the data flow demo
./run-dataflow-demo.sh /path/to/your/project

# Run the TypeScript-based runner
./run-ts-demos.sh /path/to/your/project

# Run the standard semantic analysis demo
bun run demos/semanticDemo.ts /path/to/your/project

# Run the enhanced semantic analysis demo
./run-enhanced-semantic-demo.sh /path/to/your/project 4
# Or run it directly with Node.js
node --experimental-modules --es-module-specifier-resolution=node demos/enhancedSemanticDemo.js /path/to/your/project 4

# Run just the incremental indexing demo
bun run demos/incrementalDemo.ts /path/to/your/project
```

## Core Principles

The Emergent Indexing System follows these core principles:

1. **Zero Assumptions**: The system makes no assumptions about the structure, organization, or patterns in the codebase. Everything is discovered through evidence.

2. **Organic Discovery**: Patterns, relationships, and concepts emerge naturally from the code rather than being imposed by predefined templates or expectations.

3. **Evidence-Based Understanding**: All insights are based on direct evidence, with confidence levels reflecting the strength of the evidence.

4. **Multi-dimensional Perspective**: The system views code through multiple complementary lenses:
   - Physical structure (file system)
   - Language structure (programming languages used)
   - Code structure (nodes, patterns, relationships)
   - Semantic structure (concepts, units)
   - Data flow (sources, sinks, flows, paths)

5. **Adaptive Learning**: As the system encounters more code, it refines its understanding, adjusting confidence levels and discovering new patterns.

6. **Incremental Understanding**: The system can efficiently update its understanding when code changes, without needing to reanalyze the entire codebase.

These principles allow the system to work with any codebase, regardless of language, framework, or coding conventions, building a comprehensive and adaptive understanding over time.