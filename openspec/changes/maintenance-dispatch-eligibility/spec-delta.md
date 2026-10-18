# Changed requirement

Reservation admission does not establish later provider-dispatch eligibility. After every asynchronous reservation/authority read and the last synchronous canonical-base check, the producer must obtain a fresh clock immediately before invoking the provider and require the pinned price interval, durable clock high-water and reservation UTC day/month still match. There is no await between this final clock validation and invocation.

# Acceptance scenarios

- Price expiry after actual D1 reservation commit but before its response returns results in zero provider invocations; full reservation remains held and no publication occurs.
- Crossing UTC midnight/month-end or moving before the reservation/high-water time in the same boundary likewise invokes zero times and retains accounting.
- Actual D1 restart and exact-event replay cannot dispatch or release those held reservations. Existing lost replies, ambiguous charges, known settlement, concurrency, cap/baseline and SIGKILL guarantees remain.
