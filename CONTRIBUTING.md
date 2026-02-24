# Contributing to htap

Thanks for your interest in contributing to htap! This document covers the basics you need to know.

## Licence

htap is licensed under the [MIT License](LICENSE).

## Getting Started

1. Fork the repository
2. Clone your fork and install dependencies:
   ```bash
   pnpm install
   ```
3. Create a branch for your changes
4. Make your changes
5. Run the verification suite:
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
6. Open a pull request

## Code Style

- TypeScript throughout
- British English in comments and user-facing strings
- Comments should explain the "why", not the "what"
- Follow existing patterns in the codebase
- Run `npm run lint:fix` and `npm run format` before committing

## Testing

See the testing section in [CLAUDE.md](CLAUDE.md) for detailed guidance on test types and conventions. The short version:

- Unit tests live next to the source file they test
- Integration tests go in `tests/integration/`
- E2E tests go in `tests/e2e/`
- Always run `npm run typecheck && npm run lint && npm test` before submitting

## Reporting Issues

Open an issue at [github.com/mtford90/htap/issues](https://github.com/mtford90/htap/issues). Include steps to reproduce, expected behaviour, and actual behaviour.
