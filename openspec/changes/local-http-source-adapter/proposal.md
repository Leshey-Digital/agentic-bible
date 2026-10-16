# Bounded local HTTP source adapter

Start from immutable PR #10 `d0bfca47cd221b970b01ace838afb3f3bb9a5d32`. Add a callable local Node HTTP adapter for six exact official documentation source IDs/URLs, with verified public DNS answers pinned into HTTPS, no redirects/proxies/credentials, bounded requests/time/body, conditional validators, hash-only observations and last-good-state preservation. Use existing Node built-ins; no dependency or schema is added.

The fixture Worker/runner remains unchanged. Real observations do not enter tables constrained to `mode=fixture` / `scope=local-fixture-ledger`, create article candidates or invoke the publisher. No route, UI control, environment toggle, schedule, live probe, paid provider, article publication or deployment is introduced. Controlled resolver/fetch tests exercise actual adapter logic; official-site retrieval availability and a Worker-compatible pinned egress transport remain separate integration/release work.

Limits: four charged checks per explicit process-local pass, two seconds covering resolution/headers/body/hash, 32 KiB accepted body, eight DNS answers, one HTTPS GET per check and zero automatic retries. The trusted caller must supply future durable request/day reservations before integration; a new factory is a new pass, not a global spending guard. Return sanitized typed errors with unchanged validated last-good metadata after failures. No body text or response headers containing credentials are retained/logged.

Checkpoint locally for independent review before publication. PR10 stays immutable. No migration, binding, route, credential, persistent access, main merge, deployment, funded inference or enabled remote schedule.
