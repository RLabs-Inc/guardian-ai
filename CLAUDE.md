# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GuardianAI is an AI-powered development tool featuring a dual-agent architecture:
- **Codebase Steward**: Deeply understands codebase structure, patterns, and conventions
- **Implementer Agent**: Focuses on generating well-integrated code based on the Steward's guidance

The project aims to create an AI-powered development environment where software is built and evolved with exceptional quality, perfect integration, and deep respect for the unique character of each codebase.

## Development Commands

```bash
# Install dependencies
npm install
# Or with Bun (preferred)
bun install

# Run the postinstall script to set up WASM parsers
bun run setup-wasm

# Development mode
bun run dev

# Build the project
bun run build

# Start the application
bun run start

# Run tests
npm test
```

## Project Architecture

The project follows a modular service-oriented architecture with these key components:

1. **Core Services**:
   - `LLMService`: Handles interaction with LLM providers (Anthropic, OpenAI)
   - `FileSystemService`: Manages file system operations for project analysis
   - `IndexingService`: Indexes and parses codebase using Tree-sitter
   - `RAGService`: Provides retrieval-augmented generation for the Codebase Steward
   - `AgentService`: Orchestrates interactions between agents

2. **UI Layer**:
   - Built with Ink (React for CLI)
   - Includes a comprehensive theming system with light/dark modes

3. **Command Structure**:
   - `init`: Initialize GuardianAI on a project
   - `analyze`: Analyze the current project and build the codebase index
   - `ask`: Ask a question about the codebase
   - `task`: Define a task for the Implementer agent

## Implementation Phases

The project is being implemented in phases:

1. **Phase 0**: Project Setup & Core Infrastructure
2. **Phase 1**: Codebase Steward MVP - Indexing & Basic Analysis
3. **Phase 2**: Implementer Agent MVP & Basic Steward-Implementer Interaction
4. **Phase 3**: RAG System MVP & Enhanced Steward Intelligence
5. **Phase 4**: File System Interaction & "Living Standards"
6. **Phase 5**: Advanced Features and Refinements

## Theming System

The project includes a comprehensive theming system:
- Theme definitions in `src/themes/definitions/`
- Terminal color support in `src/themes/terminalColors.ts`
- Theme context provider in `src/themes/context.tsx`
- Common UI components in `src/components/common/`

## Key Technologies

- **Language/Runtime**: TypeScript with Bun (or Node.js)
- **UI**: Ink (React for CLI)
- **Code Parsing**: Tree-sitter
- **LLM Integration**: Direct API integration with Anthropic, OpenAI
- **Vector Database**: For code embedding storage (implementation TBD)