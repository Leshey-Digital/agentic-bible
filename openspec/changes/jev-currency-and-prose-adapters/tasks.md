# Tasks

- [x] Verify official Jev API, model and coding-agent docs; preserve structured-decision-only capability.
- [x] Fix separate provider/model/tokenizer currency identity validation and permit provider model IDs.
- [x] Allow validated actual input usage to settle below its persisted maximum reservation.
- [x] Add default-disabled Jev D1 currency authority with injected token upper bounds, single-dispatch behavior and uncertain retention.
- [x] Add an injected, default-disabled Cloudflare Workers AI prose adapter with exact model binding call, required usage reader/input bound, output limit and shared D1 accounting.
- [x] Add actual local workerd/D1 controlled-provider tests for settlement, default-off behavior, invalid usage, replay, caps and retry denial.
- [x] Document official API/pricing facts, provider/account cap limits, owner setup and no-live status.
- [x] Independent scoped review of provider adapters, ledger changes, tests, docs and OpenSpec; findings recorded as owner/readiness constraints.
- [ ] Design and review versioned currency-policy rotation before continued use across the maximum 32-day price window.
- [ ] Owner approves provider price policy, actual numeric allocations, Jev token upper bound, Cloudflare usage mapping and binding/account status.

No credential, live call/spend, new Workers AI binding, public route, remote migration, article mutation, merge or deployment is part of this change.
