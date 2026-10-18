# Proposed delta

- Without explicit enablement and the controlled GitHub transport port, the writer performs zero external operations.
- Only a complete immutable maintenance generation/publication receipt with current original source/charged evidence, exact output/usage and matching source/project pins authorizes writing. Community approvals and caller-supplied article text do not.
- A canonical revision atomically includes article Markdown, immutable evidence/history JSON and current revision/review flags in one expected-head protected commit. Previous canonical revision must match the local publisher parent; unrelated Git files remain unchanged.
- A bounded D1 outbox records immutable authority, exact intent, request charges and at most one dispatch. It rejects conflicts, exhausted capacity, invalid clocks and concurrent ownership before dispatch.
- Verify actual Git commit parent, full leaf inventory and changed blob bytes before confirming a historical receipt. Replays never regenerate, reactivate or rewrite. Ambiguous dispatch only reconciles the unique history path; a changed/rolled-back base cannot be silently restored.
- Controlled actual-D1/real-Git tests establish the local contract only. No live credential, provider call, remote publication, workflow deployment or universal human article preapproval is enabled.
