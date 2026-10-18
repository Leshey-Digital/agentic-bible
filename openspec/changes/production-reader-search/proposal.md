# Reader search and topic fixes

## Problem

The Topics cards label every count as a singular article. The slash shortcut opens the search page from a reading page without focusing its field. Local full-text search also misses two supported natural-language intents when the query's words do not overlap the matching article's terminology.

## Outcome and scope

Show grammatically correct topic counts, focus search after the slash shortcut navigates from a page without a search field, and add narrow keyword expansion for explicit prompt-injection protection and duplicate-action recovery questions. Search remains a bounded local Pagefind index with fragment state, safe text rendering, same-origin article links, stale-query cancellation and existing unavailable/empty recovery behavior. Help text will accurately describe local keyword matching and its limited expansion.

## Non-goals and constraints

No article, schema, metadata, backend, dependency, or package changes; no semantic service, paid call, remote query, unbounded OR expansion, or generic security classification. Keep the existing reader visual direction and stack.

## Risks and decision

Phrase rules can still match an unintended query. Require explicit protective, agent, and injection context for injection expansion, and explicit repetition, interruption, and action context for recovery expansion. Search the original wording first and expand only after zero direct matches. Preserve honest result-status language.

## Verification

Add local browser coverage for both recognized intents, ambiguous and unrelated questions, same-origin safe result rendering, stale typing, slash-key behavior, no-JavaScript browse fallback, and index failure/retry. Run Astro check/build and the focused browser suite against the real generated Pagefind index. No deployment is included.
