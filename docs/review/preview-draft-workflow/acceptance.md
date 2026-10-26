# Inspected article revision to draft-only transport — 2026-10-26

Preserved reviewed preview: `5d3d37052c55537ec39e85c9d756ec23a5104a06`. New local branch: `feat/preview-draft-workflow`. Runtime source: `1c3c783e1c15255f00c946a10ae2cbbd0a6d9ead`; verification successors `663e30c92507618454a5a284d6d0a158f10f6bb6` and `02d61129c909dfea819997e9a8acd68a7db58043` change tests only. Runtime source tree remains `39bc838a0129b79df6efa0a07ab1dbb11bfd0d4c`. This is local source acceptance, not a frozen deployment package or complete release-runner receipt.

## Implemented reader/editor outcome

A current saved review can display the exact proposed article, append diff and provenance, then explicitly request a GitHub draft from that inspected revision. It reuses `/api/admin/corrections/github-proposal` and sends only the saved approval ID. Receipt schema, article/path, approval, base, Markdown hash, deterministic branch, head shape and exact repository URL must match before showing a recorded draft link. No merge, publication, source fetch or model action is added.

Immutable preview source is retained when the module runtime also has a configured restricted GitHub transport. Existing remote source loading and canonical-main checks retain their precedence; build/remote disagreement is not rebased or ignored. Missing runtime authority removes the action while preserving private preview/review.

An unknown response stays keyed to its approval across history reloads. Reconciliation requires another explicit action using that same approval. Pending duplicate sends are blocked; recorded replay uses the existing receipt. Newer unsaved notes survive. A changed selection/history/review cannot receive a stale completed result. Known source and branch conflicts are explained, with no overwrite or new approval invented.

## Passed controlled checks

- Full affected production-hosted suite: **67/67**, serial, 56.74 seconds at runtime source `1c3c783`. Includes native disposable workerd/D1, reader/private-inbox guards, approval dispatch/revocation and desktop/mobile regressions.
- Final new browser checks: **6/6**, 10.22 seconds after verification-only additions. Keyboard activation, unknown response, explicit same-ID reconciliation, receipt mismatch rejection, confirmed exact-preview receipt, stale completion, preserved newer text and narrow layout. Axe reports zero violations for the confirmed preview at both widths; this is partial automated accessibility evidence. Local component screenshots `/tmp/agentic-preview-draft-1440.png` and `/tmp/agentic-preview-draft-390.png`; mobile screenshot inspected.
- Native new workflow cases included in the 67: a provider response lost after creating a draft reconciles after D1 restart to one PR with byte-identical Markdown; completed replay performs zero provider calls. Foreign branch and stale main reject without overwrite. Revocation blocks later replay without deleting the already recorded draft. The unrelated Git file and canonical head stay unchanged. Module preview works with configured transport; unavailable page omits the action.
- Existing full hosted inbox/integration browser: **2/2**, 8.74 seconds. Original review/replay, controlled proposals, masked encrypted credential fixtures, accessibility and narrow-layout assertions retained.
- Existing publication suite: **14/14**, 5.56 seconds. Existing restoration suite: **18/18**, 39.50 seconds. These exercise controlled local article snapshots, history, explicit restoration, replay and interrupted-write safeguards. They are separate existing workflows, not proof that the draft UI merges or releases articles. No live publication/restoration occurred.
- Type check: **206 files**, zero errors/warnings/hints. Staging static build indexes **20 articles**; **11/11** static checks. Exact build/static rerun at `663e30c` passed; subsequent runtime bytes are unchanged. Documentation and diff checks are recorded at the final evidence checkpoint.

## Failures preserved and resolved accurately

The older browser suite failed at both widths because its first Tab assertion skipped an already existing Prepare a sourced draft link. Unchanged `5d3d370` reproduces both failures at line16:3114 using its own compiled backend and the same permitted static reader build. The test now asserts focus on that link, then retains the original selector-focus assertion after the next Tab. No original assertion, timeout or runtime behavior was weakened. Both failure logs are retained.

The first newly added axe check failed at both confirmed-preview widths because Playwright's implicit browser.newPage context cannot create axe's secondary page. Switching the test to explicit browser.newContext resolves the harness error; all six final cases and axe checks pass. The failed log is retained. Initial native authoring failures also exposed fixture expectations: configured source loading already performs four controlled reads, and revocation requires mounting the existing hosted-approval port. Correcting those fixture assumptions changed no runtime guard.

The unrelated intermittent post-dispatch failure remains **unresolved**, not fixed or reproduced here. Diagnostic commit `04a1b54` remains intact on its local investigation branch. Its three deterministic fault controls demonstrate that the same outer error can occur before or after model dispatch; the original run lacked retained phase evidence. No further broad loop or speculative runtime patch was made for it.

## Independent review and live boundaries

Independent Sol6.1 High source review accepted exact `1c3c783` with no blocking findings, then accepted the `663e30c` keyboard-only delta after checking the preserved baseline failure. The reviewer made no test, network or provider calls. The reviewer also accepted `02d6112` after checking keyboard activation, axe/context setup and retained failure evidence; runtime bytes are unchanged.

Fresh official provider reads confirmed staging version `a70ede39-1221-4a8a-983b-1ca66672bf69`, deployment `6593f4e8-aec8-4d4c-a738-f6b02f64769a`; production remains `7eccb256-0659-43c4-b2e6-5f54ac652824`, deployment `76e27d35-fe4a-4d9f-ba16-3db019f4340d`. No provider mutation occurred. Neither preview successor is claimed live.

Normal staging entry is https://staging.agenticbible.si/admin/contributions/ with Cloudflare Access login. Current reader correction route is https://staging.agenticbible.si/contribute/?article=tool-use and stays closed to public intake. Existing authenticated review acceptance remains preserved; new hosted recovery/preview/draft acceptance is not established by these fixtures.

Live draft proof needs the existing secure Worker GitHub authority and exact canonical source alignment. Connector authority is not a Worker credential. Last verified canonical main is `8a38252384c6fe6024a75b462ad95294a131100c`, while the staging content build is from the editorial recovery lineage; do not weaken stale-base checks or silently reuse old reviews. Current dispatch authorizes no credential/security change or main merge. The earlier synthetic acceptance note expressly forbidding drafts remains untouched.

The denied OpenAI local GET remains unresolved: HTTP403 via envoy at 2026-10-23T12:22:50Z for the registered function-calling URL. Headers do not identify the enforcing origin versus environment component. The smallest prerequisite is owner/platform read-only egress decision inspection and confirmation/restoration of permitted access for that exact destination. No retry, alternate route or live source acquisition was performed here. AI policy expired October23; no inference or policy renewal was attempted. The $20/month additional AI ceiling is unchanged.

The previously denied source-only draft PR was checked absent, then retried once for the same repository/head/base. Automatic approval review again rejected it before execution because it still required specific owner authorization after the denial. No further retry or alternate publication route occurred. Existing remote `5d3d370` remains unchanged; additional work stays local pending that boundary. PR58 remains unmerged. Rollback of this source change is an application revert with no migration, data cleanup or provider change.

[Sanitized command outcomes, retained failure logs and SHA-256 hashes](evidence.json).
