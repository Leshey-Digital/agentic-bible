# Added requirements

- Currency execution requires explicit valid USD policy and matching provider/model/tokenizer/usage basis before dispatch. Missing/unknown price or billed dimension stops; no inferred/default price or automatic top-up exists.
- Atomically reserve maximum bounded call cost in the existing proposal row, including run limit and day/month sums plus configured baseline. Concurrent losers cannot dispatch or double charge.
- Atomically settle known usage and response on the same owned row; release only its known unused remainder. Repeated exact settlement/restart has one charge. Changed usage/owner/input cannot acknowledge a different settlement.
- Pin policy/account/price across the shared store; caller cap increases, changed rates or simulated-mode fallback cannot bypass active currency accounting. Unpriced existing rows cannot acquire invented prices.
- Uncertain provider outcomes retain full reservation and block new events across periods. Lost reservation replies never imply permission to dispatch; lost known settlement replies reconcile durable state without another call.
- UTC periods and monotonic clocks are explicit; rollover/expired-price usage cannot silently release reservation. Keep original article bytes and post-publication flags. Gate only covered trusted invocations; never represent configured baseline as a vendor billing cap.

# Acceptance scenarios

Actual shared workerd/D1 concurrently admits one owner, survives restart, enforces exact day/month plus baseline boundaries and refuses changed policy/unknown usage. A controlled pipeline settles once before private publication, pauses and restarts through canonical Git/signed review with one provider call and one charge. Timeout/rejection/missing usage cannot publish or auto-retry. Existing synthetic workflows remain compatible when no currency store has been configured.
