# Tasks

- [x] Review the immutable versioned-policy design independently before implementation.
- [x] Add additive D1 migration for immutable policy history and per-reservation price-card identity, preserving current and populated stores.
- [x] Implement schema-version 2 monthly policy bundles with bounded unique provider/model/tokenizer price cards.
- [x] Implement atomic one-successor history append and active-pointer rotation; fail closed on uncertainty, stale/forked history or overlapping windows.
- [x] Preserve current version-1 behavior and exact existing receipts.
- [x] Add actual workerd/D1 migration, concurrency, restart, budget aggregation and uncertain-charge tests.
- [x] Verify limits cannot increase, baselines cannot decrease, UTC-period totals aggregate across policy versions, and a late pinned settlement lands in its original day/month budget.
- [ ] Review implementation independently; record exact final commit and complete release qualification separately.
