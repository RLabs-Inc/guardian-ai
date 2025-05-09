#!/usr/bin/env node
import meow from 'meow';
import React from 'react';
import {render} from 'ink';
import App from './app.js';

const cli = meow(
	`
  Usage
    $ guardian-ai <command> [options]

  Commands
    init <project_path>     Initialize GuardianAI on a project
    analyze                 Analyze the current project
    ask <question>          Ask a question about the codebase
    task <description>      Define a task for the Implementer agent

  Options
    --help, -h              Show this help message
    --version, -v           Show version number
    --model <model>         Specify LLM model to use (Anthropic)
    --openai-model <model>  Specify OpenAI model to use
    --embedding-model <model> Specify embedding model to use
    --auto-apply            Automatically apply code changes for tasks
    --verbose               Enable verbose logging

  Examples
    $ guardian-ai init ./my-project
    $ guardian-ai analyze
    $ guardian-ai ask "What does the login function do?"
    $ guardian-ai task "Add input validation to the registration form"
    $ guardian-ai ask "How does the authentication system work?" --openai-model gpt-4o
`,
	{
		flags: {
			help: {
				type: 'boolean',
				shortFlag: 'h',
			},
			version: {
				type: 'boolean',
				shortFlag: 'v',
			},
			model: {
				type: 'string',
				default: 'claude-3-7-sonnet-latest',
			},
			openaimodel: {
				type: 'string',
				default: 'gpt-4o',
			},
			embeddingmodel: {
				type: 'string',
				default: 'text-embedding-3-small',
			},
			autoapply: {
				type: 'boolean',
				default: false,
			},
			verbose: {
				type: 'boolean',
				default: false,
			},
		},
		importMeta: import.meta,
	},
);

// Parse the command and arguments
const [command, ...args] = cli.input;
const options = cli.flags;

// Render the app with the parsed command and options
render(<App command={command} args={args} options={options} />);
