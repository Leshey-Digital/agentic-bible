# Hosted maintenance history/review preparation

This separate branch starts from frozen maintenance PR38 `c35dd1e2a170205c2e5766ebf0983bd8d6a3a412`. The PR head is unchanged. This is a build-time data verifier/projection, not a new hosted route or completed review service.

`readCanonicalMaintenance` is disabled by default. Explicit controlled-static-preview mode reads a pinned local Git commit with lazy fetching and all Git transports disabled. It validates at most sixteen immutable history records plus the current pointer, bounded regular blobs, descriptor/evidence/receipt schema, source registry URLs, hashes, original one-time history creation, commit parent/message, three-file atomic changes, previous-pointer chain and the current Markdown hash. It reconstructs the exact writer historical receipt from the actual Git commit, resolving the self-reference that prevents a commit from embedding its own OID.

The projection returns newest-first history and the active revision's review flags. Private reservation tokens and simulated budget accounting are omitted. `integrity: canonical-git-only` is explicit: these checks do not revalidate private D1, source authenticity, factual correctness, identity or production approval. Historical source dates are retained. The only supported record profile is synthetic, and output is always noindex.

Tests use actual source collection, fake generation, workerd/D1 and the real-Git controlled writer, comparing reconstructed receipts directly to writer results. Tamper/partial/symlink cases exercise actual Git commits. No network, provider, D1 mutation, route, runtime binding, public page or review disposition is performed by the read-side module.

Next: wire this validated data into static Astro history/review pages at build time, retaining no-JavaScript reading and adding desktop/mobile/axe/real-search coverage. A separately authenticated append-only admin disposition/notification path needs explicit identity/owner/audit/retention design (reserve migration 0013 only if needed). Do not fetch GitHub or invoke a model on page views, reinterpret flags as prepublication approval, display synthetic records as production facts or mutate the frozen PR to add this work.

## Local preparation evidence

This local-only successor is on `feat/hosted-maintenance-history` in `/workspace/agentic-bible-hosted-history`. It does not change or publish another commit to PR38. `npm run check` passed for 128 files with zero errors, warnings or hints. `CI=1 CLOUDFLARE_CF_FETCH_ENABLED=false npm run test:maintenance-history` passed all four top-level native tests, using six disposable workerd/D1/real-Git fixture repositories and seven completed fake generations/writes. The two-revision case compares every reconstructed receipt field to the writer's actual receipts, then checks newest-first order, active flags and redacted output. The remaining cases cover empty/disabled/missing-object behavior, record rewriting, current pointer/Markdown conflicts, partial deletion and Git symlink mode.

The initial partial-deletion test used a worktree-only Git command against its bare fixture and failed before exercising the reader; the fixture now writes a deletion to its owned index with `update-index --index-info`. The complete corrected suite passes without changing reader assertions. Local proof and logs are in the actual Git worktree metadata directory: `hosted-maintenance-history-native-proof.json`, `hosted-history-check.log` and `hosted-history-tests-final.log`. The proof records the tested source commit; its generated fixtures and model calls are controlled local data.

Run the focused checks with the repository's pinned Node/npm and existing locked dependencies:

```sh
npm run check
CI=1 CLOUDFLARE_CF_FETCH_ENABLED=false npm run test:maintenance-history
node scripts/validate-docs.mjs
git diff --check
```

The new test command is intentionally separate from `validate` during this unexposed preparation. No Astro route or shipped Worker imports the reader; full browser, accessibility, build/release and hosted review-disposition checks are not claimed for this successor. PR38's separate complete CI applies to its frozen tree only. Rollback is to leave this local branch unpublished or remove the new module/test/change record; no database migration or external resource was created.
