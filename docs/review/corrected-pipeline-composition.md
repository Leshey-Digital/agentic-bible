# Corrected controlled pipeline integration

This integration began as an unpublished local checkpoint while PR48 independent review was pending. The owner subsequently reported bounded independent acceptance of exact PR48 with no actionable findings and authorized draft publication after local checks, followed by exact-head CI. Source acceptance and composition acceptance are separate; this new candidate still needs independent review and claims no main merge or deployment. [Change record](../../openspec/changes/corrected-pipeline-composition/proposal.md); [machine-readable source proof](corrected-pipeline-composition-source.json).

## Exact inputs and scope

| Input | Exact head | Review status supplied by owner |
|---|---|---|
| Main | `6987bf2c53d8ddc9ffb34d9b89d453caf0adf213` | Qualified with explicit artifact-transfer limitation |
| PR46 controlled pipeline composition | `6af6cde08edab58e9abdd1cff9b428849239173f` | Bounded acceptance; frozen head has the later confirmed monitor defect |
| PR47 release documentation | `566877cc5e5685b088f145df6be27c65a03c293a` | Bounded independent acceptance, no findings |
| PR48 monitor successor | `2d67d191d91721178f0de937f7cdbaedef38eb5a` | Bounded independent acceptance, no actionable findings |

PR48 includes corrected currency-dispatch head `b280d5b9ca38d4f617f6601c8c42fcb641b67466` and original currency head `25e95cfa015609c0fc204db7274e2387992890dd`. Their implementation now belongs to this explicitly requested composition; the earlier PR46 instruction excluding currency describes that historical checkpoint. This does not enable a real provider, approve numeric paid allocation or cap actual Cloudflare bills.

Main fast-forwards locally to the preserved PR46 commit. A normal merge adds accepted PR47; another normal merge adds exact PR48. Only README/AGENTS append sections conflict. Both histories are retained, duplicate pipeline instructions appear once, and incoming currency/dispatch/monitor instructions are renumbered. PR47's current main/status/setup guidance and all historical evidence remain. New files describe only this local composition.

All application, script, test, dependency, migration and workflow blobs match PR48 exactly. Differences from PR48 are documentation/instructions inherited from main, PR46, PR47 or added for this handoff. All twenty article bytes, lockfile and three Wrangler configs match every named input. The release workflow is identical across inputs; the validation workflow retains PR48's currency/monitor checks. Existing runtime defaults and closed live authority remain unchanged.

The complete input and composed ancestry excludes unpublished cache-isolation `6b140131281a780f5e069a5c73c5b54f6f449b27`. No version of its code is imported: in particular `scripts/maintenance-review-build.mjs` remains the exact PR48 blob. No frozen input branch is edited or rebased.

## Verification and reproduction

Use package-pinned Node/npm and `npm ci` in an isolated standalone clone. Keep captured source/package files fixed during active snapshot tests. Run:

```sh
npm run validate
npm run test:monitoring:worker
npm run test:settings:worker
npm run test:maintenance-history:browser
npm run test:maintenance-restore:browser
npm run staging:check
npm run runtime:check
npm run release:prepare
```

Full validation includes the twelve pipeline, thirteen currency, seven storage-monitor, fourteen release and five restored-base cases. The monitor suite uses actual filesystem churn, real Astro/Pagefind, owned Git and actual local D1; six fatal capacity/path controls retain charge/canonical state and safely bounded diagnostics. Currency tests retain expiry/midnight/backward-clock dispatch rejection and reservation/settlement/restart behavior. Release tests retain actual pinned-CLI duplicate-version faults and complete asset/runtime verification. Retained history/restoration browsers exercise desktop/mobile composition paths. Commands and actual passed/failed/not-run results, final head/tree and proof paths are recorded in the returned handoff and private `.git/corrected-composition-validation.json`.

No PR CI can run before publication. Full retained browser coverage on source PR CI is prior evidence, not a replacement for a future integration CI result. A local candidate artifact is not a successful main-push release artifact or authority to deploy.

## Local validation record

At clean checkpoint `ba310aac146e8f58cc54092102f51cf7a6467101`, full validation passed 263 native tests, including twelve pipeline, thirteen currency, seven monitor, fourteen release and five restored-base cases. The two retained native persistence checks also passed, for 265 total native tests. Twelve history and two restoration browser cases passed on desktop/mobile with system Chromium 154.0.8037.57. No unexpected review-build failure occurred in this run. Full 143-case browser coverage was not rerun locally; the final published-head CI must report its own result with pinned Chromium separately.

After those snapshot tests finished, only review-status/handoff documentation and instructions were updated. Application, test, script, package, workflow and migration blobs remain exactly PR48. Final source packaging/build checks and terminal publication CI are recorded for their actual head in the PR handoff; earlier local checks are not relabeled as runs of a later commit.

## Historical limits and stopping condition

Original PR44 review-build evidence remains 11/12. PR44/PR45 historical failures lost detailed diagnostics and cannot conclusively be attributed to the independently reproduced monitor race. Passing this composition does not erase failures or show every generic build error is fixed. The independent shared Astro-cache collision remains outside this candidate; its unpublished isolation checkpoint is excluded deliberately.

The [dated owner setup/transfer handoff](../commit-pinned-releases.md#observed-status-and-owner-preparation-2026-10-18) remains in force. GitHub environment/secret/enablement settings are unverified, and that inspection found the staging hostname/DNS absent. No setup or blocked transfer retry occurs here. The release path's intended GitHub-runner artifact download and digest/source verification remain distinct from the workspace CONNECT-proxy failure; no live release execution is claimed. No Jev key is needed for static reading/search.

The PR48 review result has now been supplied and the owner authorizes draft publication after passing local checks. Any new finding takes priority over composition. Independent exact-head composition review, main merge and release remain separate gates. There are no live credentials, paid/provider calls, remote article writes, migrations/resources, deployments, indexing or license changes. Rollback of this local branch is to preserve the four inputs and discard the unpublished composition; never erase canonical records, uncertain operations or held charges. Existing canonical-base and currency records still require format-aware readers on downgrade.
