# Indexing Service Cleanup Plan

## Current Structure
The current indexing service has several components:

1. **Main indexing folder**
   - `index.ts` (exporting from currently missing files)
   - `types.ts` (general indexing interfaces and types)
   - `indexingService.js` (referenced but missing in TypeScript form)
   - `parsers/` folder
   - `treeSitter.ts`

2. **emergentIndexing subfolder** (main implementation we're using)
   - Core implementation files (emergentIndexingService.ts, etc.)
   - Various analyzers (dependencyAnalyzer.ts, semanticAnalyzer.ts, etc.)
   - Support utilities (hashTracker.ts, etc.)
   - Demo and test files

3. **hierarchicalIndexing subfolder** (not actively used)
   - Various implementation files 
   - Contains hashTracker.ts which might be reused

4. **llmDirected subfolder** (referenced in main index.ts but missing)

## Analysis Findings

1. The `analyze.tsx` command directly imports from the `emergentIndexing` subfolder
2. There is no dependency on the `hierarchicalIndexing` folder from the emergent indexing
3. There are missing files referenced in the main `index.ts`
4. We should retain tree-sitter functionality that's being used
5. There are unused demo files and shell scripts in the emergent indexing folder

## Cleanup Strategy

### Phase 1: Clean Existing Structure
1. Remove all files from hierarchicalIndexing except hashTracker.ts (may be used)
2. Remove llmDirected folder (currently missing/unused)
3. Clean up demonstration scripts and unused files in emergentIndexing
4. Remove parsers folder if unused

### Phase 2: Prepare for Migration
1. Create empty new file structure for integrated implementation
2. Adapt main index.ts to properly export emergent indexing
3. Create temporary placeholder files for future integrated implementation

### Phase 3: Final Migration (After Refactoring Complete)
1. Move integrated implementation to main indexing folder
2. Remove emergentIndexing subfolder
3. Update imports in commands to use new paths

## Immediate Action Plan

1. Clean up hierarchicalIndexing, retain only hashTracker.ts
2. Remove unused demo files and scripts from emergentIndexing
3. Update main index.ts to correctly export from emergentIndexing
4. Create skeleton for integrated indexing structure

## Files to Keep

### Main indexing folder:
- `index.ts` (will be updated)
- `types.ts`

### emergentIndexing folder:
- Core services:
  - emergentIndexingService.ts
  - emergentIndexingServiceFactory.ts
  - hashTracker.ts
  - understandingStorage.ts
  - types.ts

- Analyzers:
  - languageDetector.ts
  - patternDiscovery.ts
  - relationshipDetector.ts
  - semanticAnalyzer.ts
  - dependencyAnalyzer.ts
  - dataFlowAnalyzer.ts

- Support:
  - codeElementClustering.ts
  - index.ts

## Files to Remove

### hierarchicalIndexing folder:
- All files except hashTracker.ts

### emergentIndexing folder:
- Demo and test files:
  - demo.ts
  - demos/* (all files in demos folder)
  - allDemosRunner.ts
  - run-*.sh (all shell scripts)
  - examples/* (all files in examples folder)

### Other:
- llmDirected folder (if present)
- parsers folder (if present)
- Any temp or generated files not in source control

## Tentative Timeline

1. **Day 1**: Initial cleanup and preparation (current task)
2. **Days 2-5**: Implement new integrated architecture
3. **Days 6-7**: Testing and final migration