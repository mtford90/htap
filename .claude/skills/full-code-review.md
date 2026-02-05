# /full-code-review

Comprehensive 8-dimension code review using parallel opus agents.

## Description

This skill launches 8 opus-worker agents in parallel, each focusing on a specific dimension of code quality. Results are compiled into a single checklist document stored in `docs/reviews/<date>/code-review.md`.

## Dimensions

1. **React/Ink Best Practices** - Rules of hooks, component lifecycle, state management, memoization, re-render efficiency
2. **TypeScript Quality** - Type safety, `any` usage, type assertions, generics, discriminated unions
3. **Code Completeness** - Incomplete implementations, TODOs, edge cases, error handling, dead code
4. **Test Coverage** - Missing tests, edge cases, test quality, flaky patterns
5. **Project Organisation** - Module boundaries, circular deps, naming consistency, separation of concerns
6. **Security** - Input validation, injection risks, sensitive data handling, permissions
7. **UX/UI Principles** - Keyboard navigation, visual hierarchy, error feedback, accessibility
8. **Performance** - Memory leaks, re-renders, query efficiency, large data handling

## Instructions

When this skill is invoked, execute the following:

### Step 1: Create output directory

```bash
mkdir -p docs/reviews/$(date +%Y-%m-%d)
```

### Step 2: Launch 8 parallel opus-worker agents

Launch all 8 agents simultaneously using the Task tool with `subagent_type: "opus-worker"` and `model: "opus"`. Each agent should run in the background (`run_in_background: true`).

**Agent 1: React/Ink Best Practices**
```
Review the codebase for React/Ink best practices, focusing on src/cli/tui/.

Check for:
1. Rules of hooks - conditional hooks, dependency arrays, missing dependencies
2. Component lifecycle - effect cleanup, memory leaks
3. State management - prop drilling, state lifting
4. Custom hooks - conventions, encapsulation
5. Memoization - missing useMemo/useCallback
6. Re-render issues - unnecessary re-renders
7. Ink-specific patterns - proper use of Box, Text, useInput, useApp

For each issue: provide file:line, code snippet, issue description, and recommended fix.
```

**Agent 2: TypeScript Quality**
```
Review the entire codebase for TypeScript quality and type safety.

Check for:
1. Any `any` types - explicit or implicit
2. Unsafe type assertions (`as` casts)
3. Loose typing - places where types could be more specific
4. Missing return types on exported functions
5. Generics misuse or opportunities
6. Null/undefined handling - unsafe non-null assertions (!)
7. JSON.parse without validation

For each issue: provide file:line, code snippet, issue description, and recommended fix.
```

**Agent 3: Code Completeness**
```
Review the codebase for code completeness and correctness.

Check for:
1. Incomplete implementations - partial coverage (e.g., missing status codes)
2. TODO/FIXME comments
3. Edge cases not handled
4. Error handling gaps - swallowed errors, missing try-catch
5. Missing validation
6. Hardcoded values that should be constants
7. Dead code - unused functions, unreachable paths
8. Incomplete switch/if-else - missing cases

For each issue: provide file:line, code snippet, what's missing, and recommended fix.
```

**Agent 4: Test Coverage**
```
Review the codebase for test coverage gaps.

Compare src/ against tests/ to find:
1. Missing unit tests - untested utilities, formatters, helpers
2. Missing component tests - untested TUI components
3. Missing integration tests - untested daemon/proxy behaviours
4. Edge cases not tested in existing tests
5. Test quality issues - over-mocking, coverage theatre
6. Flaky test patterns - timing-dependent tests

For each gap: describe what's missing and what test cases should be added.
```

**Agent 5: Project Organisation**
```
Review the codebase for project organisation and architecture.

Check for:
1. Module boundary violations - code in wrong directories
2. Circular dependencies
3. File naming inconsistency
4. Directory structure issues
5. Code duplication
6. Import organisation issues
7. Separation of concerns violations

For each issue: describe the problem, files affected, and recommended restructuring.
```

**Agent 6: Security**
```
Review the codebase for security concerns.

Check for:
1. Input validation gaps - CLI args, API inputs
2. Path traversal risks
3. Command injection risks
4. SQL injection (check for parameterised queries)
5. Sensitive data handling - credentials, tokens in logs/storage
6. File/socket permissions
7. Unbounded resource growth (DoS risks)

For each issue: provide file:line, severity (Critical/High/Medium/Low), and recommended mitigation.
```

**Agent 7: UX/UI Principles**
```
Review the TUI for UX/UI principles.

Check for:
1. Keyboard navigation - consistency, discoverability
2. Visual hierarchy - important info prominence
3. Error feedback - how errors are communicated
4. Loading states - async operation indicators
5. Empty states - guidance when no data
6. Help/discoverability - can users find actions?
7. Colour usage - meaningful, accessible
8. Terminal compatibility - Unicode, mouse support assumptions

For each issue: describe the UX concern, where it occurs, and recommended improvement.
```

**Agent 8: Performance**
```
Review the codebase for performance concerns.

Check for:
1. Memory leaks - uncleaned listeners, growing data structures
2. Unnecessary re-renders in TUI
3. Database efficiency - missing indices, SELECT *, N+1 queries
4. Large data handling - memory spikes, streaming opportunities
5. IPC efficiency - serialisation overhead
6. Synchronous I/O blocking event loop
7. Resource cleanup - connections, file handles

For each issue: provide file:line, potential impact, and recommended optimisation.
```

### Step 3: Wait for all agents to complete

Monitor agent progress. Once all 8 have completed, proceed to compilation.

### Step 4: Compile results

Create a single markdown file at `docs/reviews/<date>/code-review.md` with:

1. **Progress section** - checklist of all 8 categories
2. **Each category** as a numbered section with checkboxes for each issue
3. **Quick Wins section** - issues that can be fixed in minutes
4. **High Impact section** - issues that should be prioritised

Format each issue as:
```markdown
- [ ] **X.Y: Issue title**

  **File:** `path/to/file.ts:line`

  **Issue:** Description of the problem.

  **Fix:** Recommended solution.
```

### Step 5: Update PLAN.md

Add a "Technical Debt" section to `docs/PLAN.md` linking to the review and listing the high-impact items.

### Step 6: Report summary

Provide a summary table to the user showing:
- Issues found per category
- Top 5 quick wins
- Top 5 high-impact items
