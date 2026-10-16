# Accurate lease status

- A running job without an unexpired lease must never report busy/http_in_progress. Compare lease expiry strictly against the trusted status-read clock used by the durable action; equality is expired.
- If budget or another admission gate prevents reclaiming an expired job, return the existing blocked/http_not_due_or_budget response. Repeated blocked calls and runtime restart add no fetch, reservation or attempt, preserve the charged daily counter and last-good metadata, and retain the abandoned reservation.
- An explicit same-key call after UTC-day rollover can proceed only through the existing atomic claim gates. Persisted retry backoff still blocks early requests and replays the original retry receipt. Eligible retries charge once; successful receipts replay after restart without dispatch.
- Active leases remain busy; terminal/success/retry receipt replay, stale completion fencing, conservative charging and all existing safety bounds remain unchanged. No automatic retry or schedule is introduced.
