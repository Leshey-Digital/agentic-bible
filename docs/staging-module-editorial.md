# Local staging module editorial composition

This successor to PR55 makes private review-to-saved-note usable without a runtime GitHub credential. The existing hosted router remains the entrypoint; its ASSETS.fetch dependency uses the unchanged module server preserved from the production recovery. D1 and trusted environment bindings pass through unchanged. All frozen staging content bytes, origin and noindex headers remain pinned.

Private inbox access still requires exact HOSTED_PRIVATE_INBOX=enabled, valid signed admin trust and D1. Checked-in preparation config has no opt-in, public intake settings or paid-provider policy. The composition does not generate credentials or infer GitHub authority from the connected assistant tool.

## Review source and saved-note boundary

Without a GitHub transport, the explicit private composition supplies a source preview from an immutable build snapshot. The builder obtains Markdown with git show at the content commit and verifies every hash against release-source.json. Markdown is embedded in the Worker, not added to public static paths. The source endpoint retains normal admin authentication and no-store responses. The UI says remote main has not been checked.

Before saving a build-source review, the server requires the exact snapshot commit, Markdown hash and an actual citation ID. Existing signed identity, CSRF, owner, follow-up disposition, submission revision, capacity, atomic save and replay checks remain. A note is saved in the existing review tables; no article or GitHub record is created. Its history survives restart. No new migration is needed.

GitHub proposals remain503 when runtime authority is absent. The UI explicitly says the note is saved and draft creation is unavailable. When a GitHub transport is separately configured in the future, existing proposal validation still compares the saved base with current main and verifies content before writes; a stale build review is not silently rebased.

## Reproducible local preparation

The local acceptance consumes the frozen PR55 staging content candidate. Its manifest SHA256 is260142f11656ed643fbc2091479d47bef14f605331ce9bfbd89eeb3d74f933f9 and content commitb81e2093e80cb8dc31b56fcb14f969dad124bdfa. The candidate files must be present; tests do not silently skip missing artifacts or download replacements.

Run from the repository root, with a new output directory:

```sh
node scripts/prepare-staging-module.mjs .git/private-editorial-candidate 260142f11656ed643fbc2091479d47bef14f605331ce9bfbd89eeb3d74f933f9 .git/staging-module-candidate
node --test tests/staging-module/composition.test.mjs
```

Set STAGING_MODULE_CANDIDATE to the restored frozen candidate directory if it lives elsewhere. The builder fails on changed candidate bytes, mismatched Git content, wrong staging discovery, or an existing output directory. Its manifest records content and implementation commits separately, dirty tracked-source status, module/config hashes and measured package size. It makes no provider request.

The preparation config retains EDITORIAL_DB1ca9a6f8-c0a9-4040-8a2f-e22d888a985a and required names HOSTED_ADMIN_TRUST, INTEGRATION_VAULT_KEY and INTEGRATION_VAULT_KEY_ID. Future native version metadata must inherit those existing secrets from the reconciled staging version, not insert their values. No ASSETS provider resource is needed: this implementation supplies the fetch facade from data modules. This preparation does not implement upload/activation or change controller admission.

The builder binds maintenance-history.json to the hosted maintenance reader. It also binds release.json when present; the current frozen content has no release.json, so releaseCommit=null and both release verification fields remainfalse. No qualification receipt is invented.

## Evidence and remaining remote boundary

Focused native tests cover every public asset byte/header, redirects, HEAD/range, closed default admin/intake, no public Markdown source, authenticated save/replay/restart/history, rejected altered source pins/citation/revision/CSRF, unavailable GitHub draft, zero source-fetch budget use and zero outbound calls. A390px Chromium journey loads the actual composed Worker through a synthetic signed local gateway and saves/reads a note. It does not claim real Access login acceptance.

Independent review accepted the composition after correcting missing compile-time metadata bindings. Typecheck covered198 files with zero errors/warnings/hints. Exact final counts/package pins are in the accompanying review receipt. Earlier PR55 44/45 initialization failure and isolated21/21 rerun remain historical evidence, not overwritten by these focused passes.

No main merge, upload, activation, remote binding, D1 data write, credential or security change occurred. Production/recovery source is unchanged. Full target-specific release qualification and a normal authorized staging Access session remain unperformed. GitHub runtime authority is a separate prerequisite for draft creation, not for saving and reading a private note. Existing account billing configuration remains unchanged; module-served requests are Worker requests and this is not a monetary cap or a verified free-plan claim.
