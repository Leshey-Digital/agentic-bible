# Hosted production composition

## Problem and outcome

The hosted Worker contains contribution, signed review and write-only integration-settings routes, but its shipped entrypoint does not construct the required adapters. This change composes those routes only from explicit validated runtime bindings, keeps all optional routes closed by default, and adds privacy-minimal aggregate intake outcomes.

## Scope and non-goals

Compose the existing D1 contribution/review path and encrypted integration settings vault from validated bindings; require signed admin trust and explicit moderation policy; derive a non-reversible intake rate key from Cloudflare ingress identity using a separately supplied HMAC key; add bounded daily outcome counters with a 14-day application retention window; provide a non-deployable placeholder config and actual-Worker local D1 coverage.

No binding values, credentials, signing keys, terms or privacy policy are supplied. No hosted identity, database, provider, infrastructure, public access or deployment is provisioned or enabled. The existing staging and production configurations remain unchanged. Jev connection testing remains unsupported because no non-billable test contract exists. These counters are not a monetary budget or an account-wide rate guarantee.

## Risks and alternatives

An incomplete or malformed optional binding must leave its route closed. The existing worker still verifies signed claims and same-origin protections. Intake derives only an HMAC digest from the Cloudflare connecting-IP header; if the trusted ingress value or HMAC key is missing, intake is unavailable. Counter storage failure returns an error for otherwise successful submissions so an admission is not represented as monitored success; submission request replay remains idempotent.

Physical expiry is opportunistic: each counter write prunes rows older than the 14-day window, and the admin read API filters the same window. With no further traffic or admin read, expired rows can remain physically stored until the next counter access; no scheduler is configured.

## Decisions

The repository owner still supplies real trust, moderation/policy bindings, D1 and vault/rate keys through an approved runtime setup. This code change does not imply readiness or permission to configure them.
