# Jev admin staging rollout

This checklist separates routine staging rollout from owner-controlled security configuration. It does not authorize changes to the live account. The qualified release checkpoint must be reviewed and deployment separately authorized before an operator acts.

## Routine staging operator work

1. Confirm the target is the existing `agentic-bible-staging` Worker and `staging.agenticbible.si`; leave the production Worker and apex unchanged. Use the reviewed source commit and its qualified candidate bytes.
2. The current runtime config packages Assets and `nodejs_compat`, but has no D1 binding. With Cloudflare access to the staging project, bind the existing approved editorial D1 database as `EDITORIAL_DB`. If none exists, obtain the project/resource authorization required to create that database before proceeding; this task does not create it.
3. With D1 migration permission, apply the repository migrations in order through `0025_hosted_abuse_counters.sql`. This includes `0010_maintenance_proposals.sql`, `0016_maintenance_currency.sql`, `0023_jev_integration_vault.sql`, `0024_currency_policy_rotation.sql`, and `0025_hosted_abuse_counters.sql`, plus their earlier prerequisites. Do not skip or manually edit migrations.
4. After the protected bindings below are available, deploy the reviewed branch candidate to the staging Worker. The integration setup UI can be deployed and used while `JEV_DISPATCH_POLICY` is absent: the runtime reports Jev as `not-mounted`, and `/api/admin/jev/evaluate` stays closed. No Jev request is sent. The UI can save a credential later, after the owner approves that entry and the protected admin path is live.
5. Verify the staging Worker version, `/admin/integrations/` access, constant mask/write-only behavior, and runtime status. Confirm no `JEV_DISPATCH_POLICY` is present and evaluation remains unavailable. Do not treat UI or fake-transport success as provider connectivity.

These steps require staging project and D1 permissions for the operator executing them; they are ordinary deployment/database operations, not provider-secret setup. Actual creation of a missing database requires resource authorization for the named staging account/project.

## Owner-controlled security and paid-use settings

1. The owner or delegated identity administrator must approve the signed-admin issuer, audience and subject membership for `leshey@w3africa.com`. Configure `HOSTED_ADMIN_TRUST` only after verifying the identity provider's issuer/key metadata and that the approved subject is emitted in the signed assertion.
2. The owner or delegated secrets administrator must provision and retain the 256-bit AES-GCM vault key, then put it in the staging Worker secret store as `INTEGRATION_VAULT_KEY` with a version label in `INTEGRATION_VAULT_KEY_ID`. Do not store the provider API key in either binding. The vault key is not recoverable from D1 and must have an owner-approved backup/rotation procedure.
3. Keep the Typesafe API key in the owner's password manager until compatible protected staging code, trusted identity, D1, migrations and vault key are confirmed. The owner then enters it through `/admin/integrations/` → **Typesafe Jev**. The Worker encrypts it into the owner-bound D1 row. Never paste it into chat or an ordinary Worker variable.
4. Jev stays unmounted until the owner separately chooses a supported pinned model and approves an explicit `JEV_DISPATCH_POLICY` with its matching price card, validity window, conservative token bounds and numeric run/day/month caps. Only the owner may authorize `enabled:true`. Funded provider status or the repository's operating target is not a spend cap.

Identity and vault setup enable the UI without paid dispatch. Entering the Jev key is optional and still does not enable calls while `JEV_DISPATCH_POLICY` is absent. Jev has no documented non-billable connection check in this implementation, so saving the credential does not test it and status remains unverified.

## Evidence and rollback

The local Worker dry-run validates packaging only; it does not prove D1, identity, vault, provider, or staging deployment. Record the exact deployed Worker version, migration result, status response, and owner approval separately. If deployment fails before migrations, restore the prior Worker version. After applying migration 0023 or later, keep the schema and encrypted rows intact when rolling code back; old code may leave Jev records inaccessible, but dropping or rewriting them is not a rollback step.
