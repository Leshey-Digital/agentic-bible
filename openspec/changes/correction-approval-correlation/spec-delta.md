# Proposed correction transaction requirement

A batch may advance a submission and record an approval audit only when the stored immutable approval exactly matches that batch's full candidate. Existence of the request key or fingerprint alone is insufficient. On conflict, the losing batch has zero submission/audit effects, including across different submission IDs and successive revisions of one submission. Immutable winning approval and original audit survive restart and retain exact retry.

Identical concurrent input with differing server timestamps returns the first approval without another version/audit effect. Forced schedules use actual workerd/D1; no source-pin/time-limit/assertion weakening or synthetic production identity is permitted. Preserve original article files and interactive state.
