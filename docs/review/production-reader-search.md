# Reader and search production fixes

This focused candidate corrects the Topics count grammar, returns keyboard users directly to a focused search field when `/` opens Search, and recognizes two specific keyword fallbacks: explicit prompt-injection protection questions and repeated-action recovery after interruptions. Direct Pagefind matches remain first. Fallbacks require multiple contextual signals and are limited to `prompt injection` and `durable agent execution`; this is local keyword matching, not general language understanding.

Search remains in the browser against the generated bounded Pagefind index. Query fragments, same-origin article path checks, text-only rendering, sequence invalidation, empty/error/retry states and the no-JavaScript browse list remain part of the contract. Existing reader colors, typography and stack are preserved.

## Evidence

Exact head: see the per-check status record at `.git/production-reader-search-evidence/status.json` (updated after the local checkpoint commit).

- `npm run test:docs`: passed; 312 Markdown files and 375 relative file links checked.
- `npm run check`: passed; 159 Astro files, 0 errors/warnings/hints.
- `npm run build`: passed; 31 pages built and Pagefind indexed the 20 article pages.
- `npm test`: passed; 9 tests.
- Focused real-Pagefind Playwright: passed; 12 tests across desktop and mobile, including held-fragment out-of-order sequencing, no-JavaScript browsing, local index failure, shortcut focus and both query expansions. Chromium was `/usr/bin/chromium` 154.0.8037.57.
- `git diff --check`: passed.
- Docs/source-scope review: passed; only the delegated reader/search files, focused test, OpenSpec record and this handoff were changed.

No deployment, staging mutation, credential setup, tracking, paid call, or external search request is part of this candidate. A first browser run failed only because a new test incorrectly required the MCP result to rank first; the assertion was corrected to check that the article appears. The retained first log preserves that test-only failure. Rollback is reverting this small reader/search change and its focused tests/spec record.
