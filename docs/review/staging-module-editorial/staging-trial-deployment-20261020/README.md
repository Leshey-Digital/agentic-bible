# Staging private-editor deployment evidence — 2026-10-20

Operation `ea861401-b9ea-48d0-a396-7493a453502f` completed one inactive upload and staging activation. Version `11e56042-5e04-4cd6-a136-f5d3f4abbe10` serves 100% through deployment `cc3fd2aa-df84-44dc-8351-c1fabfba1368`.

The user explicitly approved the specific Access session change from 8h to 1h, authenticated inbox enablement and accepted-package staging deployment. Only application `899e2890-cf6e-4902-b535-97855e22fefc` changed duration. Protected destinations and identity providers were unchanged; audit/readback reconciled the policy comparison to its update timestamp alone. No new credentials or secret values were read or published.

## Artifact and metadata

Frozen module candidate `bb6663fabb4254766eec456d76dcc8833e68f3eda0e08c0814de56cc2b4fe7eb` remains byte-identical. The approved metadata variant adds `HOSTED_PRIVATE_INBOX=enabled` and the operation annotation. Existing staging D1 and three inherited secrets are preserved. Payload hash and metadata are recorded separately; the enabled variant is not claimed to have unchanged metadata.

The original qualification runner remains failed. Acceptance uses preserved original evidence, independent continuation at `ba24a617a57be0e20f440560a497112bf278ff5e`, package inspection and independent review. No successful original-runner receipt is claimed.

## Observed serving checks

Home, tool-use article, search, history and robots GETs returned 200, noindex headers and exact frozen hashes. Runtime status returned 200 with contribution admin configured, public intake false, GitHub proposals false, hosted canonical writes false and Jev dispatch not mounted. The absence of release.json correctly reports release-manifest verification false. A public submissions GET returned 503. These checks do not establish browser search interaction or authenticated editor behavior.

Admin entry: https://staging.agenticbible.si/admin/

Observed redirect destination, with the entire query omitted to avoid session material: https://old-snow-1dd6.cloudflareaccess.com/cdn-cgi/access/login/staging.agenticbible.si

Use the admin entry to start a fresh normal login. **Authenticated note save/readback is NOT yet verified.** No editor login, synthetic submission, fixture seeding or private review write occurred. Parent/user handles the real-browser boundary.

## Rollback and production

Retained staging version `5d532da5-b15c-4e64-8ae7-634f69831dcb` remains the native rollback pin. Reactivation preserves D1 rows but retires the new inbox workflow; it is not a database downgrade and cannot manage schema-2 notes. No rollback occurred.

Provider readback confirmed production unchanged: deployment `e046cf4a-6f57-404d-a50a-504788058ee5`, version `28c2c556-ab43-482a-98e7-7d2aa8d6965c`, 100%.

## Preservation scope

This checkpoint contains sanitized results, public GET hashes and metadata, not module bodies, credentials, cookies, JWTs, complete login redirect queries or unnecessary process details. Original private journals and payloads remain local. Earlier source-publication checks found no Workers Build triggers for staging/production and no executable repository Actions workflows. This preservation turn ran no tests, login, provider changes or data writes; it only published repository evidence.
