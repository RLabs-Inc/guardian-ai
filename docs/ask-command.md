# The Ask Command

The `ask` command is GuardianAI's interface to the Codebase Steward, allowing you to query your codebase with natural language. This document explains how to use this powerful feature to understand, navigate, and improve your code.

## Basic Usage

The simplest way to use the `ask` command is to provide a natural language question about your codebase:

```bash
guardian-ai ask "How does the authentication system work?"
```

This will:
1. Find your project's GuardianAI configuration
2. Load the codebase index
3. Retrieve relevant code context using vector search
4. Generate a detailed response using the Codebase Steward

## Query Types

Different types of questions require different approaches. The `ask` command automatically detects the query type, but you can also specify it explicitly:

```bash
guardian-ai ask "What pattern is used for state management?" --type pattern
```

Available query types:

| Type           | Flag Value       | Good For                                         |
|----------------|------------------|--------------------------------------------------|
| Explanation    | `explanation`    | Understanding how code works                     |
| Architecture   | `architecture`   | High-level system design questions               |
| Implementation | `implementation` | Guidance on adding features                      |
| Pattern        | `pattern`        | Identifying design patterns and code conventions |
| Relationship   | `relationship`   | Understanding component dependencies             |
| Bug            | `bug`            | Debugging issues or analyzing problems           |
| Standard       | `standard`       | Discovering codebase conventions                 |

## Advanced Options

### Getting Analysis Details

To see more detailed analysis along with the answer:

```bash
guardian-ai ask "What are the key components in this project?" --analysis
```

The `--analysis` flag includes additional information like:
- Identified patterns with confidence scores
- Component relationships
- Relevant files

### Verbose Mode

For maximum detail, use verbose mode:

```bash
guardian-ai ask "How do error boundaries work?" --verbose
```

This includes all available analysis, similar to using the `--analysis` flag.

### Providing Additional Context

You can provide additional context to help the Steward answer your question:

```bash
guardian-ai ask "Why is this approach used for caching?" --context "The system needs to support offline mode"
```

## Example Questions by Type

### Explanation Questions

```bash
guardian-ai ask "How does the login process work?"
guardian-ai ask "What happens when a user submits a form?"
guardian-ai ask "What is the purpose of the caching middleware?"
```

### Architecture Questions

```bash
guardian-ai ask "What's the overall architecture of this system?"
guardian-ai ask "How is the project structured?"
guardian-ai ask "What are the main subsystems and how do they interact?"
```

### Implementation Questions

```bash
guardian-ai ask "How should I implement a new authentication provider?"
guardian-ai ask "What's the best way to add a new API endpoint?"
guardian-ai ask "How would I extend the notification system to support SMS?"
```

### Pattern Questions

```bash
guardian-ai ask "What design patterns are used in this codebase?"
guardian-ai ask "How is dependency injection implemented?"
guardian-ai ask "What patterns are used for async operations?"
```

### Relationship Questions

```bash
guardian-ai ask "How does the frontend communicate with the backend?"
guardian-ai ask "What components depend on the UserService?"
guardian-ai ask "How does data flow through the application?"
```

### Bug Questions

```bash
guardian-ai ask "Why might users be experiencing timeouts on the search page?"
guardian-ai ask "What could cause the race condition in the order processing?"
guardian-ai ask "Why would the cache invalidation fail intermittently?"
```

### Standard Questions

```bash
guardian-ai ask "What naming conventions are used in this project?"
guardian-ai ask "How should error handling be implemented according to the codebase standards?"
guardian-ai ask "What testing patterns are established in this project?"
```

## Tips for Effective Queries

1. **Be specific**: "How does authentication work?" will give better results than "How does auth work?"

2. **Provide context**: Mention specific components or areas when relevant

3. **Ask follow-up questions**: You can drill down on details after getting a general answer

4. **Use the right query type**: If the automatic detection isn't giving the best results, specify the query type explicitly

5. **Ask about code relationships**: Questions about how components interact often yield the most useful insights

6. **Look at the analysis**: For complex questions, the analysis details can provide valuable additional context

## Troubleshooting

### "No GuardianAI project found"

Run `guardian-ai init` in your project directory first to initialize GuardianAI.

### "Codebase index not found"

Run `guardian-ai analyze` to build the codebase index before asking questions.

### "Vector DB not found, continuing without context"

This warning means the system will try to answer without vector search context. For better results, ensure your codebase has been analyzed with `guardian-ai analyze`.

### Incomplete or incorrect answers

Try:
- Being more specific in your question
- Specifying the query type explicitly
- Adding `--analysis` to see what context the system is using
- Running `guardian-ai analyze` again to refresh the index

## Using Ask Command Output

The output from the `ask` command can be used in several ways:

1. **Documentation**: Save detailed architectural explanations for team reference

2. **Onboarding**: Help new team members understand the codebase quickly

3. **Planning**: Use implementation guidance for estimating work and planning tasks

4. **Code Reviews**: Reference pattern and standards information during reviews

5. **Debugging**: Understand potential causes of bugs and issues

## Performance Considerations

- First query after loading may be slower as the vector database is loaded
- Subsequent queries are typically faster as the context is cached
- The `--analysis` flag requires additional processing time
- Larger codebases may require more time for comprehensive analysis