# Staging admin runtime bindings

## Problem

The release candidate currently declares only the static asset binding. It cannot package the approved staging editorial D1 binding or preserve the owner-configured hosted admin and integration-vault settings.

## Outcome

Pin the existing staging editorial D1 resource in the candidate and permit only the fixed hosted-admin/vault secret bindings. Uploads inherit those named secrets from Cloudflare with strict binding inheritance. Candidate artifacts contain names and resource IDs only, never secret values. Jev dispatch remains unmounted.

## Scope and non-goals

- Add exact staging D1 metadata and a fixed required-secret list to release candidate configuration.
- Enforce exact version bindings and validate binding readiness without returning binding values.
- Keep existing source, candidate, account/Worker, noindex, activation, rollback, and qualification gates.
- Do not set Cloudflare variables or secrets, deploy, create resources, call providers, or enable Jev.
- Do not accept arbitrary extra bindings or embed owner identity/key values in a bundle.

## Dependencies and risks

The owner must configure the named D1 binding and three secrets in Cloudflare before the first reviewed upload. The connector upload must use Cloudflare's strict `bindings_inherit` mode; a missing or differently typed binding must fail before version creation.

## Decision

Use the already approved staging D1 UUID `1ca9a6f8-c0a9-4040-8a2f-e22d888a985a`; store `HOSTED_ADMIN_TRUST`, `INTEGRATION_VAULT_KEY`, and `INTEGRATION_VAULT_KEY_ID` as Cloudflare secrets. This change makes no external Cloudflare request.
