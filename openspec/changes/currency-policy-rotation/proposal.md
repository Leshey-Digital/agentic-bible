# Versioned currency policies without accounting resets

The production provider adapters share one immutable proposal currency ledger, but its singleton policy row can only be initialized on an empty proposal table. Its single price card also cannot account for Jev decisions and Cloudflare prose in the same app month. Add append-only currency-policy history and safe, month-boundary policy changes so provider/model additions and rate updates never clear or replace old proposal accounting.

## Scope

- Preserve every proposal's exact policy, selected provider/model price card, maximum reservation, settled usage/cost and uncertain state.
- Add an append-only, single-successor policy history and retain the existing row as the active policy pointer.
- Support a version-2 policy bundle with exact price cards for multiple provider/model/tokenizer identities under one shared account cap.
- Require version-2 policy windows to cover one UTC calendar month, with no overlap against the active policy. If a gap occurs, execution stays disabled until the later window begins.
- Carry every retained reserved/settled/uncertain USD row into the matching UTC day and month period across all policy versions. Keep all history indefinitely, but do not carry prior-day/month costs into a later budget period. Open or uncertain charges continue to block new dispatch and rotation.
- Keep all provider execution default-disabled and preserve exact model, tokenizer and price-card selection.

## Non-goals

- No automatic reconciliation, refund or release of uncertain reservations.
- No claim that app-level USD rates equal Cloudflare's account bill, especially where pricing is Neurons.
- No provider call, credential, binding, deployment, remote migration or article mutation.
- No increase of owner allocations. Policy controls and provider pricing remain separately approved.

## Design

Version 1 policies remain readable for existing receipts. New long-running configurations use schema version 2: one UTC calendar-month window, one shared set of finite run/day/month caps and one to a small bounded number of immutable exact price cards. A card is selected by exact provider, model and tokenizer and its ID is stored with each reservation. Jev and Workers AI may therefore share one app-wide budget without switching active policy between calls. New monthly windows cannot overlap the active policy. To prevent allocation increases from being smuggled in with rate rotation, a successor may not raise run/day/month limits or lower either configured baseline; those changes require a separate reviewed authorization design.

Migration creates immutable policy history from the active singleton and retained proposal rows, with a self-referential prior hash and a unique successor per predecessor. A new policy is appended and made active only when the current pointer/hash is unchanged, its account identity is the same, its start is at or after the previous policy's expiry, its UTC window is exactly one calendar month, it does not increase app caps or lower account baselines, and no proposal is still calling, reserved, or uncertain. A missing/stale/branched history or any unpriced row rejects rotation. D1 batches guard history append, active-pointer move and proposal reservation against races.

Reservations and settled costs from all policies stay in `maintenance_proposals`; UTC day/month sums include every policy version for rows in the same respective day/month. Thus rotating a card cannot reset spend inside a live period, while the normal UTC day/month cycle still resets that period's budget. An uncertain row retains its full maximum charge and blocks later provider dispatch until a future separately reviewed evidence-based reconciliation mechanism exists. No such mechanism is added here.

Admission and immediate dispatch eligibility require the pinned price window to be current. Settlement uses the exact rate card in the durable reservation and remains allowed after UTC midnight or policy expiry, provided reported usage is valid and within the reservation. The reservation already consumed its maximum in its original UTC day/month; settlement releases only its known difference against that same original period. A timeout, unknown or excess usage remains uncertain and blocks policy rotation.

## Review risks

- Concurrent old-policy reservation and new-policy rotation must have one durable winner; the loser must stop before provider dispatch.
- Rotation must fail closed if a prior hash has multiple successors, if proposals lack a matching retained policy, if the active pointer disagrees with history, or if any open/uncertain reservation exists.
- App-level USD accounting and Cloudflare Neuron/account-wide billing remain different authorities; no cap here is a provider billing guarantee.

## Acceptance

- Actual local D1 migration/backfill and restart preserve exact prior policies, charges and uncertain rows.
- Actual D1 concurrency proves old reservation versus rotation has one winner and never double-admits cost.
- Cross-policy daily/monthly totals include all policy versions within the same UTC period; next-day/month admission resets only the appropriate period.
- Policy rotation cannot raise run/day/month limits or lower day/month baselines; policy identity and per-card prices settle exactly.
- A bounded request reserved before midnight/window expiry can settle afterward at its pinned card; unknown usage stays held.
- Missing, overlapping, off-boundary, forked, stale, unpriced and open-reservation rotations fail closed.
- Existing version-1 receipts remain verifiable; all existing maintenance/currency behavior remains passing.
