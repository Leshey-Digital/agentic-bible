# First-slice review evidence

Feature branch: `feat/reference-library-slice`, based on foundation PR #1 at `aed0712786afadb31cc11d14399b8a113ff330e0`. Foundation PR is unmerged. This evidence is for the owner-authorized local reading slice, not a deployment or launch approval.

Primary source pages for all three entries were opened and checked on 2026-10-16. Article references record publisher, source context and protocol revision. All content remains an AI-assisted working draft pending independent editorial review; a checked URL does not establish approval.

## Reproduction

Use Node 24.19.0 and npm 11.9.0. Run `npm ci`, `npm run validate`, `npm run staging:check`, and `npm run test:browser` from the repository. Browser tests need system Chromium or `npm run browser:install`; see README.

Saved-environment results on 2026-10-16:

| Check | Result |
|---|---|
| `npm ci` | Passed; exact lockfile install, 310 packages |
| `npm run validate` | Passed; 20 Markdown files / 21 relative file links, zero Astro/TypeScript diagnostics, 11 static pages, three Pagefind entries, four static tests |
| `npm run test:browser` | 14 passed in 18.0s; desktop 1440px and mobile 390px, system Chromium |
| axe WCAG A/AA checks | No violations on seven representative pages at both viewport sizes; partial automated evidence |
| `npm run staging:check` | Passed; local Wrangler dry run, 48 artifact files, no bindings, no upload/deployment |
| `npm audit --json` | Zero reported vulnerabilities at check time |
| Source verification | Eight distinct primary source pages opened and checked; ten article reference records |
| Diff/limited secret-pattern scan | Passed; limited patterns are not a complete security audit |
| Remote CI, independent review and cloud smoke test | Not claimed; CI is configured, reviews pending, nothing deployed |

Browser checks cover citations, related links, topics, real Pagefind queries, empty/no-result/punctuation states, rapid query replacement, index failure plus successful reload recovery, keyboard skip/search/Escape flows, no-JavaScript reading/browse fallback, genuine 404, staging headers, no horizontal overflow, and no external browser requests or runtime/CSP errors in read/search flows.

The local runtime has Git 2.52.0, Python 3.12.14, pnpm 11.25.0, corepack 0.34.6 and system Chromium 154.0.8037.57. npm is the selected package manager. No repository `.agents/skills` or parent AGENTS.md was present. The catalog frontend skill was unavailable when the build scope arrived, so the explicit design brief and repository instructions were used.

The initial npm/Astro default home cache paths were unwritable; project-local caches and disabled telemetry resolve this without privilege escalation. Playwright's browser CDN returned HTTP 403 in the saved environment; system Chromium provided real browser coverage. Wrangler's local `Request.cf` lookup falls back to a placeholder here, so tests do not claim real edge geolocation/account behavior. A browser check caught Pagefind's WebAssembly CSP requirement; the policy allows `wasm-unsafe-eval` while continuing to block inline scripts and ordinary script eval.

Screenshots, inspected from the final built local preview:

- [Desktop library](library-desktop.png)
- [Mobile library](library-mobile.png)
- [Article, sources and revision record](article-desktop.png)
- [Real Pagefind results](search-desktop.png)

To reproduce them, start `npm run staging:local`, then run `PLAYWRIGHT_BROWSERS_PATH=.git/playwright node scripts/capture-screenshots.mjs`. The exact pushed commit is recorded in the PR, avoiding a self-referential commit hash in this file.

## Scope and remaining gates

Reading, topics, source anchors, related links, GitHub file history and browser-local Pagefind are implemented. Workers configuration is static-only, names only `agentic-bible-staging`, uses account `c370be29e4065365de03bc8652da2cdc`, and has no routes, bindings, scheduler or credentials. `staging.agenticbible.si` is the preview canonical origin, not a live site. No DNS, cloud resources, account settings, funding or production state was changed.

Independent code/design and editorial review remain pending. Licensing and contribution terms are still unresolved; public submissions remain off. Production origin validation, release evidence, analytics/retention decisions and numeric paid-job/Jev limits remain separate gates. The founder accepted the $10 monthly operating target and reviewed release authority on 2026-10-16. Automatic publication with post-publication review flags supersedes the initial manual editorial gate; that pipeline and the admin inbox/settings remain unimplemented.
