# GuardianAI

GuardianAI is an AI-powered development tool featuring a "Codebase Steward" and "Implementer" agent duo that ensures new features and modifications are implemented with total integration into existing codebases, adhering to established or emergent standards and patterns.

![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Project Vision

GuardianAI aims to create an AI-powered development environment where software is built and evolved with exceptional quality, perfect integration, and deep respect for the unique character of each codebase. It fosters a true human-AI partnership in the art of software creation.

The dual-agent architecture addresses core limitations of existing AI coding tools:
- The **Codebase Steward** deeply understands codebase structure, patterns, and conventions
- The **Implementer Agent** focuses on generating well-integrated code based on the Steward's guidance

## Features

- **Deep Codebase Understanding**: Indexes and analyzes your entire codebase structure
- **AI-Powered Assistance**: Leverages advanced LLMs (Claude) to understand and enhance your code
- **Clean TUI Interface**: React-based terminal UI for smooth interaction
- **Smart Code Generation**: Respects your existing patterns and conventions

## Installation

### Prerequisites

- Node.js 16+ or Bun runtime
- Anthropic API key for Claude LLM access

### Install globally

```bash
$ npm install --global guardian-ai
```

### Local development setup

```bash
# Clone the repository
git clone https://github.com/yourusername/guardian-ai.git
cd guardian-ai

# Install dependencies
npm install
# or with Bun
bun install

# Set up environment variables
cp .env.example .env
# Edit .env and add your Anthropic API key

# Build the project
npm run build
# or with Bun
bun run build

# Link for local development
npm link
```

## Usage

```bash
# Initialize GuardianAI in your project
guardian-ai init ./my-project

# Analyze your codebase
guardian-ai analyze

# Ask questions about your code
guardian-ai ask "How does the authentication system work?"

# Define implementation tasks
guardian-ai task "Add input validation to the registration form"
```

## Commands

- `init <project_path>` - Initialize GuardianAI on a project
- `analyze` - Analyze the current project and build the codebase index
- `ask <question>` - Ask a question about the codebase
- `task <description>` - Define a task for the Implementer agent

## Configuration

### Environment Variables

Create a `.env` file in your project root (see `.env.example`):

```
ANTHROPIC_API_KEY=your_api_key_here
```

### Project Configuration

After initialization, GuardianAI creates a `.guardian-ai.json` file in your project root with configuration settings.

## Development

GuardianAI is built with:

- TypeScript
- Ink (React for CLI)
- Anthropic API (Claude)
- Tree-sitter for code parsing

### Development Workflow

```bash
# Watch mode for development
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

MIT

## Acknowledgements

- Anthropic for the Claude AI models
- Vadim Demedes for the Ink library
- Tree-sitter for code parsing capabilities