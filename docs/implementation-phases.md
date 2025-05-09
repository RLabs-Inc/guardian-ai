# GuardianAI - Implementation Plan (Draft 1)

**Project Vision:** To create an AI development tool with a "Codebase Steward" and "Implementer" agent duo that ensures new features and modifications are implemented with total integration into existing codebases, adhering to established or emergent standards and patterns, resulting in clean, objective, and straightforward code.

## Phase 0: Project Setup & Core Infrastructure

**Objective:** Establish the foundational elements for the project.

**Key Tasks:**

1.  **Define Core Technologies (Finalized):**
    - TUI: Ink (React for CLI)
    - Language/Runtime: TypeScript with Bun (or Node.js)
    - LLM APIs: Direct interaction with Anthropic, OpenAI (and/or Gemini as decided).
    - Version Control: Git
2.  **Project Scaffolding:**
    - Set up TypeScript project structure.
    - Initialize Bun/Node.js environment.
    - Basic TUI structure with Ink.
3.  **Core Services (Initial Stubs/Interfaces):**
    - `LLMService`
    - `FileSystemService`
    - `IndexingService`
    - `RAGService` / `KnowledgeBaseService`
    - `AgentOrchestrator`
4.  **Basic CLI Command Structure:**
    - Define initial commands (e.g., `guardian-ai init <project_path>`, `guardian-ai task "<description>"`).

---

## Phase 1: Codebase Steward MVP - Indexing & Basic Analysis

**Objective:** Get the Codebase Steward to perform an initial, basic indexing of a project and extract some rudimentary patterns or information (non-LLM analysis for Steward initially).

**Key Tasks:**

1.  **Codebase Parser Implementation (Core of `IndexingService`):**
    - Integrate Tree-sitter.
    - Traverse directories, parse files to ASTs.
    - Extract basic info (file structure, function/class names, imports/exports).
2.  **Initial "Knowledge Representation":**
    - Simple in-memory/file-based storage for indexed data.
3.  **Basic Steward "Analysis" Logic:**
    - Query stored data (e.g., "List functions in file X").
4.  **TUI Integration:**
    - User points to project directory.
    - Display indexing progress/feedback.
    - Display high-level stats from Steward's analysis.

---

## Phase 2: Implementer Agent MVP & Steward-Implementer Basic Interaction (No RAG yet)

**Objective:** Have the Implementer agent take a very simple task, consult a simplified Codebase Steward (using Phase 1 indexed data), and generate a code snippet.

**Key Tasks:**

1.  **Implementer Agent Core:**
    - Basic prompt structure for simple code generation.
    - Integrate with `LLMService`.
2.  **Simplified Steward Consultation Logic:**
    - Implementer asks Steward for basic context (e.g., existing functions in a file).
    - Steward provides this from its Phase 1 non-LLM indexed data.
3.  **Implementer Uses Steward's Info:**
    - Implementer's prompt to LLM includes simple context from Steward.
4.  **Basic Tooling for Implementer:**
    - Safe `displayCode(code)` tool (TUI output only).
5.  **TUI:**
    - User inputs simple task.
    - Display Steward's "briefing" and Implementer's generated code.

---

## Phase 3: RAG System MVP & Enhanced Steward Intelligence

**Objective:** Introduce a proper RAG system for the Codebase Steward, allowing it to use LLM capabilities to analyze the indexed codebase and provide more intelligent guidance.

**Key Tasks:**

1.  **Vector Database Setup:**
    - Choose and integrate a vector DB (e.g., local FAISS).
2.  **Embedding Generation (Enhance `IndexingService`):**
    - Generate embeddings for code snippets, comments, patterns.
    - Store embeddings in vector DB.
3.  **Steward's RAG Query Logic (Enhance `RAGService`):**
    - Steward formulates queries.
    - Retrieves relevant info from vector DB.
    - Uses LLM to synthesize retrieved info + task into a comprehensive "Implementation Briefing."
4.  **Refine Steward-Implementer Interaction:** Implementer receives richer briefing.

---

## Phase 4: Implementer Agent - File System Interaction & "Living Standards"

**Objective:** Allow the Implementer agent to safely modify files based on the Steward's guidance, and have the Steward start forming its "living standards."

**Key Tasks:**

1.  **Implementer File Tools (via `FileSystemService`):**
    - `readFile(filePath)`.
    - `writeFile(filePath, content)` / `modifyFile(filePath, changes)` (with safety/confirmation).
2.  **Steward's "Living Standards" Generation (Initial):**
    - Steward formulates and stores key patterns/standards based on RAG analysis.
    - This enriches its briefings.
3.  **Feedback Loop (Implementer -> Steward -> Codebase Update):**
    - Re-index affected files after changes.
    - Steward's knowledge evolves.
4.  **TUI Enhancements:**
    - Show diffs.
    - User confirmation for file ops.

---

## Phase 5: Iteration, Advanced Features, and User Experience Refinements

**Objective:** Build upon the MVP, adding more sophisticated features and improving usability.

**Potential Features:**

- Advanced Steward code analysis (data flow, semantic understanding).
- Advanced Implementer tools (testing, linting).
- Proactive Steward suggestions (refactoring, standards enforcement).
- Complex task handling (task decomposition).
- Robust error handling and recovery.
- Detailed logging and session management.
- Enhanced TUI (visualizations, navigation).

---
