# Getting Started with GuardianAI

This guide will help you set up and use GuardianAI to leverage the Codebase Steward for your projects.

## Installation

The project is currently in development, so you'll need to run it from the source code:

```bash
# Clone the repository
git clone https://github.com/yourusername/GuardianAI.git
cd GuardianAI

# Install dependencies
npm install
# or with Bun (preferred)
bun install

# Run the postinstall script to set up WASM parsers
bun run setup-wasm
```

## Configuration

Before using GuardianAI, you need to set up your API keys:

1. Create a `.env` file in the project root:

```bash
touch .env
```

2. Add your API keys to the `.env` file:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
```

## Basic Usage

Due to current development status, you'll need to run the CLI commands directly using `ts-node` or `bun`:

### Initialize GuardianAI in your project

```bash
# Navigate to your project directory
cd /path/to/your/project

# Initialize GuardianAI 
npx ts-node /path/to/GuardianAI/source/cli.tsx init

# Or if you're using Bun
bun --cwd /path/to/GuardianAI run source/cli.tsx init
```

### Analyze your codebase

This builds the index that the Codebase Steward will use:

```bash
# From your project directory
npx ts-node /path/to/GuardianAI/source/cli.tsx analyze

# Or with Bun
bun --cwd /path/to/GuardianAI run source/cli.tsx analyze
```

### Ask questions about your codebase

Now you can start asking questions using the Codebase Steward:

```bash
# Basic question
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "How does the authentication system work?"

# With a specific query type
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "What pattern is used for state management?" --type pattern

# Include detailed analysis
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "What are the key components?" --analysis
```

## Testing the Codebase Steward

The Codebase Steward excels at understanding code patterns, relationships, and providing implementation guidance. Here are some good test questions:

### Architecture Questions

```bash
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "What's the overall architecture of this system?"
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "How is the project structured?"
```

### Pattern Questions

```bash
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "What design patterns are used in this codebase?"
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "How is dependency injection implemented?"
```

### Relationship Questions

```bash
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "How do the components interact?"
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "What services depend on the AuthService?"
```

### Implementation Questions

```bash
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "How should I implement a new authentication provider?"
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "What's the best way to add a new API endpoint?"
```

## Advanced Usage

For advanced features like pattern recognition or living standards documentation, use the `--analysis` flag:

```bash
npx ts-node /path/to/GuardianAI/source/cli.tsx ask "What patterns are used for async operations?" --analysis
```

## Troubleshooting

If you encounter issues:

1. Make sure your API keys are correctly set in the `.env` file
2. Ensure you've run the `init` and `analyze` commands before asking questions
3. Try specifying the query type explicitly with `--type`
4. Check that your project has actual code to analyze

## Next Steps

After becoming familiar with the basic usage, explore the more advanced features:

- Vector-based pattern recognition
- Relationship mapping between components
- Living standards documentation
- Implementation guidance for new features