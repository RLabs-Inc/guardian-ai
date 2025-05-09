# GuardianAI Implementation Guide

## Project Overview

GuardianAI is an AI-powered development tool featuring a "Codebase Steward" and "Implementer" agent duo that ensures new features and modifications are implemented with total integration into existing codebases, adhering to established or emergent standards and patterns, resulting in clean, objective, and straightforward code.

The dual-agent architecture addresses core limitations of existing AI coding tools:

- The **Codebase Steward** deeply understands codebase structure, patterns, and conventions
- The **Implementer Agent** focuses on generating well-integrated code based on the Steward's guidance

## Implementation Phases

### Phase 0: Project Setup & Core Infrastructure

**Objective:** Establish the foundational elements for the project.

**Key Tasks:**

1. **Define Core Technologies (Finalized):**
   - TUI: Ink (React for CLI)
   - Language/Runtime: TypeScript with Bun (or Node.js)
   - LLM APIs: Direct interaction with Anthropic, OpenAI (and/or Gemini as decided)
   - Version Control: Git
2. **Project Scaffolding:**
   - Set up TypeScript project structure
   - Initialize Bun/Node.js environment
   - Basic TUI structure with Ink
3. **Core Services (Initial Stubs/Interfaces):**
   - `LLMService`
   - `FileSystemService`
   - `IndexingService`
   - `RAGService` / `KnowledgeBaseService`
   - `AgentOrchestrator`
4. **Basic CLI Command Structure:**
   - Define initial commands (e.g., `guardian-ai init <project_path>`, `guardian-ai task "<description>"`)

### Phase 0.5: Proof-of-Concept

**Objective:** Create a minimal working demo that proves the core concept.

**Key Tasks:**

1. **Simple File Reader:**
   - Basic file-system traversal to read a small sample codebase
2. **Minimal Codebase Representation:**
   - In-memory structure to hold basic code information
3. **Simple LLM Interaction:**
   - One-shot query to demonstrate the concept
4. **Demo TUI:**
   - Ultra-simple interface showing the flow from query to analysis to answer
5. **User Testing:**
   - Get early feedback on the core concept

### Phase 1: Codebase Steward MVP - Indexing & Basic Analysis

**Objective:** Get the Codebase Steward to perform an initial, basic indexing of a project and extract some rudimentary patterns or information.

**Key Tasks:**

1. **Codebase Parser Implementation (Core of `IndexingService`):**
   - Integrate Tree-sitter
   - Traverse directories, parse files to ASTs
   - Extract basic info (file structure, function/class names, imports/exports)
2. **Git History Integration:**
   - Parse commit history related to files
   - Extract insights about code evolution and intent from commit messages
3. **Initial "Knowledge Representation":**
   - Simple in-memory/file-based storage for indexed data
4. **Basic Steward "Analysis" Logic:**
   - Query stored data (e.g., "List functions in file X")
5. **TUI Integration:**
   - User points to project directory
   - Display indexing progress/feedback
   - Display high-level stats from Steward's analysis

### Phase 2: Implementer Agent MVP & Steward-Implementer Basic Interaction

**Objective:** Have the Implementer agent take a very simple task, consult a simplified Codebase Steward, and generate a code snippet.

**Key Tasks:**

1. **Implementer Agent Core:**
   - Basic prompt structure for simple code generation
   - Integrate with `LLMService`
2. **Simplified Steward Consultation Logic:**
   - Implementer asks Steward for basic context (e.g., existing functions in a file)
   - Steward provides this from its Phase 1 indexed data
3. **User Feedback Mechanism:**
   - Allow users to correct or supplement the Steward's understanding
   - Incorporate feedback into future interactions
4. **Basic Tooling for Implementer:**
   - Safe `displayCode(code)` tool (TUI output only)
5. **TUI:**
   - User inputs simple task
   - Display Steward's "briefing" and Implementer's generated code

### Phase 3: RAG System MVP & Enhanced Steward Intelligence

**Objective:** Introduce a proper RAG system for the Codebase Steward, allowing it to use LLM capabilities to analyze the indexed codebase and provide more intelligent guidance.

**Key Tasks:**

1. **Vector Database Setup:**
   - Choose and integrate a vector DB (e.g., local FAISS)
2. **Embedding Generation (Enhance `IndexingService`):**
   - Generate embeddings for code snippets, comments, patterns
   - Store embeddings in vector DB
3. **Steward's RAG Query Logic (Enhance `RAGService`):**
   - Steward formulates queries
   - Retrieves relevant info from vector DB
   - Uses LLM to synthesize retrieved info + task into a comprehensive "Implementation Briefing"
4. **Testing & Evaluation Framework:**
   - Metrics for evaluating the quality of the Steward's understanding
   - Benchmark tests for common code tasks
5. **Refine Steward-Implementer Interaction:**
   - Implementer receives richer briefing

### Phase 4: Implementer Agent - File System Interaction & "Living Standards"

**Objective:** Allow the Implementer agent to safely modify files based on the Steward's guidance, and have the Steward start forming its "living standards."

**Key Tasks:**

1. **Implementer File Tools (via `FileSystemService`):**
   - `readFile(filePath)`
   - `writeFile(filePath, content)` / `modifyFile(filePath, changes)` (with safety/confirmation)
2. **Steward's "Living Standards" Generation (Initial):**
   - Steward formulates and stores key patterns/standards based on RAG analysis
   - This enriches its briefings
3. **Feedback Loop (Implementer -> Steward -> Codebase Update):**
   - Re-index affected files after changes
   - Steward's knowledge evolves
4. **TUI Enhancements:**
   - Show diffs
   - User confirmation for file ops

### Phase 5: Iteration, Advanced Features, and User Experience Refinements

**Objective:** Build upon the MVP, adding more sophisticated features and improving usability.

**Potential Features:**

- Advanced Steward code analysis (data flow, semantic understanding)
- Advanced Implementer tools (testing, linting)
- Proactive Steward suggestions (refactoring, standards enforcement)
- Complex task handling (task decomposition)
- Robust error handling and recovery
- Detailed logging and session management
- Enhanced TUI (visualizations, navigation)

## Terminal Theming System Implementation

### Theme Types Definition

```typescript
// src/themes/types.ts
export interface ThemeColors {
	// Primary UI colors
	primary: string; // Main accent color
	secondary: string; // Secondary accent color

	// Text colors
	text: string; // Regular text
	dimText: string; // Secondary, less important text
	highlightText: string; // Important text

	// Background colors
	background: string; // Main background
	panel: string; // Panel/card background

	// State colors
	success: string; // Success states
	error: string; // Error states
	warning: string; // Warning states
	info: string; // Info states

	// UI element colors
	border: string; // Borders
	selection: string; // Selected items
}

export interface Theme {
	name: string;
	colors: ThemeColors;
}
```

### Terminal Color Support

```typescript
// src/themes/terminalColors.ts
import chalk from 'chalk';

// Function to use terminal's default color scheme
export function getTerminalColors(): ThemeColors {
	return {
		primary: chalk.blue,
		secondary: chalk.cyan,
		text: chalk.white,
		dimText: chalk.gray,
		highlightText: chalk.bold.white,
		background: '', // Use terminal default
		panel: chalk.bgBlack,
		success: chalk.green,
		error: chalk.red,
		warning: chalk.yellow,
		info: chalk.blue,
		border: chalk.gray,
		selection: chalk.bgBlue,
	};
}
```

### Theme Definitions

```typescript
// src/themes/definitions/dark.ts
import {Theme} from '../types';
import chalk from 'chalk';

export const darkTheme: Theme = {
	name: 'Dark',
	colors: {
		primary: chalk.hex('#61AFEF'),
		secondary: chalk.hex('#98C379'),
		text: chalk.hex('#ABB2BF'),
		dimText: chalk.hex('#5C6370'),
		highlightText: chalk.hex('#E5C07B'),
		background: '', // Use terminal default
		panel: chalk.bgHex('#282C34'),
		success: chalk.hex('#98C379'),
		error: chalk.hex('#E06C75'),
		warning: chalk.hex('#E5C07B'),
		info: chalk.hex('#61AFEF'),
		border: chalk.hex('#5C6370'),
		selection: chalk.bgHex('#3E4451'),
	},
};

// src/themes/definitions/light.ts
import {Theme} from '../types';
import chalk from 'chalk';

export const lightTheme: Theme = {
	name: 'Light',
	colors: {
		primary: chalk.hex('#0184BC'),
		secondary: chalk.hex('#4078F2'),
		text: chalk.hex('#383A42'),
		dimText: chalk.hex('#A0A1A7'),
		highlightText: chalk.hex('#986801'),
		background: '', // Use terminal default
		panel: chalk.bgHex('#FAFAFA'),
		success: chalk.hex('#50A14F'),
		error: chalk.hex('#E45649'),
		warning: chalk.hex('#C18401'),
		info: chalk.hex('#0184BC'),
		border: chalk.hex('#A0A1A7'),
		selection: chalk.bgHex('#E5E5E6'),
	},
};
```

### Theme Context Provider

```typescript
// src/themes/context.tsx
import React, {createContext, useContext, useState} from 'react';
import {Theme, ThemeColors} from './types';
import {darkTheme} from './definitions/dark';
import {lightTheme} from './definitions/light';
import {getTerminalColors} from './terminalColors';

// Default themes
const themes: Theme[] = [
	darkTheme,
	lightTheme,
	{
		name: 'Terminal Default',
		colors: getTerminalColors(),
	},
];

type ThemeContextType = {
	currentTheme: Theme;
	setTheme: (themeName: string) => void;
	availableThemes: string[];
};

const ThemeContext = createContext<ThemeContextType>({
	currentTheme: themes[0],
	setTheme: () => {},
	availableThemes: themes.map(t => t.name),
});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({
	children,
}) => {
	const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);

	const setTheme = (themeName: string) => {
		const theme = themes.find(t => t.name === themeName);
		if (theme) {
			setCurrentTheme(theme);
		}
	};

	return (
		<ThemeContext.Provider
			value={{
				currentTheme,
				setTheme,
				availableThemes: themes.map(t => t.name),
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => useContext(ThemeContext);
```

### Theme Loader

```typescript
// src/themes/loader.ts
import {Theme} from './types';
import {darkTheme} from './definitions/dark';
import {lightTheme} from './definitions/light';
import {getTerminalColors} from './terminalColors';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Default themes
const builtInThemes: Theme[] = [
	darkTheme,
	lightTheme,
	{
		name: 'Terminal Default',
		colors: getTerminalColors(),
	},
];

export function loadThemes(): Theme[] {
	// Start with built-in themes
	const themes = [...builtInThemes];

	// Check if user themes directory exists
	const userThemesDir = path.join(process.cwd(), 'themes', 'custom');

	try {
		if (fs.existsSync(userThemesDir)) {
			const files = fs.readdirSync(userThemesDir);

			// Look for YAML theme files
			const yamlFiles = files.filter(
				file => file.endsWith('.yaml') || file.endsWith('.yml'),
			);

			// Load each YAML theme
			// For simplicity, we're not implementing the actual YAML parsing here
			// You would use a library like js-yaml to parse these files
			console.log(`Found ${yamlFiles.length} custom themes`);

			// This is where you'd parse and validate each theme file
			// and add valid themes to the themes array
		}
	} catch (error) {
		console.error('Error loading custom themes:', error);
	}

	return themes;
}
```

### Usage Example

```tsx
// src/components/common/Text.tsx
import React from 'react';
import {Text as InkText} from 'ink';
import {useTheme} from '../../themes/context';

interface TextProps {
	variant?: 'default' | 'dim' | 'highlight';
	children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({variant = 'default', children}) => {
	const {currentTheme} = useTheme();

	let color;
	switch (variant) {
		case 'dim':
			color = currentTheme.colors.dimText;
			break;
		case 'highlight':
			color = currentTheme.colors.highlightText;
			break;
		default:
			color = currentTheme.colors.text;
	}

	return <InkText color={color}>{children}</InkText>;
};
```

## Project Structure

Here's a recommended directory structure for the GuardianAI project:

```
guardian-ai/
├── assets/                   # Static assets (if any)
├── dist/                     # Compiled output
├── node_modules/             # Dependencies
├── src/                      # Source code
│   ├── agents/               # Agent implementations
│   │   ├── codebaseSteward/  # Codebase Steward implementation
│   │   ├── implementer/      # Implementer Agent implementation
│   │   └── prompts/          # Agent system prompts
│   ├── components/           # UI components
│   │   ├── common/           # Common UI elements
│   │   │   ├── Text.tsx      # Themed text component
│   │   │   ├── Box.tsx       # Themed box/container component
│   │   │   └── ...
│   │   ├── layout/           # Layout components
│   │   └── screens/          # Screen components
│   ├── services/             # Core services
│   │   ├── fileSystem/       # File system service
│   │   ├── llm/              # LLM integration service
│   │   ├── indexing/         # Code indexing service
│   │   ├── rag/              # Retrieval augmented generation service
│   │   └── ...
│   ├── themes/               # Theme system
│   │   ├── context.tsx       # Theme context provider
│   │   ├── loader.ts         # Theme loader
│   │   ├── terminalColors.ts # Terminal colors utility
│   │   ├── types.ts          # Theme type definitions
│   │   └── definitions/      # Theme definitions
│   │       ├── dark.ts       # Dark theme
│   │       └── light.ts      # Light theme
│   ├── utils/                # Utility functions
│   ├── app.tsx               # Main application component
│   └── cli.ts                # CLI entry point
├── themes/                   # User-editable theme files (future)
│   ├── dark.yaml             # Dark theme
│   ├── light.yaml            # Light theme
│   └── custom/               # Directory for user-added custom themes
├── .env.example              # Example environment variables
├── .gitignore                # Git ignore file
├── package.json              # Package information and scripts
├── README.md                 # Project documentation
└── tsconfig.json             # TypeScript configuration
```

## Getting Started

### 1. Project Initialization

```bash
# Create new Ink-based project
npx create-ink-app guardian-ai

# Navigate to project directory
cd guardian-ai

# Install additional dependencies
npm install chalk fs-extra yaml tree-sitter @types/fs-extra
```

### 2. Implement the Theming System

1. Create the theme-related directories and files:

```bash
mkdir -p src/themes/definitions
mkdir -p src/components/common
```

2. Copy the theme-related TypeScript files to their respective locations.

3. Update the main `App.tsx` to use the theming provider:

```tsx
// src/App.tsx
import React from 'react';
import {Box, Text} from 'ink';
import {ThemeProvider} from './themes/context';
import {Text as ThemedText} from './components/common/Text';

const App = () => (
	<ThemeProvider>
		<Box flexDirection="column">
			<ThemedText variant="highlight">GuardianAI</ThemedText>
			<ThemedText>The AI-powered code integration tool</ThemedText>
			<ThemedText variant="dim">Version 0.1.0</ThemedText>
		</Box>
	</ThemeProvider>
);

export default App;
```

### 3. Test the Theming System

Run the application to verify that the theming system is working correctly:

```bash
npm run dev
```

You should see the text rendered with the default theme colors.

### 4. Next Steps

After implementing the theming system, you can proceed with:

1. Setting up the core service interfaces
2. Implementing the Proof-of-Concept phase
3. Beginning work on the Codebase Steward indexing capabilities

## Resources

- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Chalk Documentation](https://github.com/chalk/chalk)
- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
