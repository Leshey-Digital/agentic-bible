# Added requirements

- Provider price identity includes separate provider, exact model and tokenizer identity. Scoped model identifiers are allowed only as exact validated values.
- A zero price for a billed dimension is valid only when explicitly pinned in the exact model price card; it is never inferred from an omitted field.
- A Jev call requires an enabled trusted server authority, valid pinned currency policy, model-specific input/output upper bounds, durable reservation, immediate price/clock revalidation, validated usage settlement and one-shot dispatch. Unknown token bounds or prices stop before provider dispatch.
- Settlement may reduce a reserved input maximum only when the measured usage is valid and no greater than the persisted reservation. Unknown, excess or missing usage keeps the maximum reservation uncertain and blocks replay dispatch.
- The Workers AI prose adapter requires an injected binding, explicit currency policy, trusted input-token upper bound and response-usage mapper. It sends the pinned model with bounded prompt and `max_tokens`, returns unverified draft text, and never authorizes factuality, review or publication.
- No real provider/binding is enabled by default. Controlled fake-binding success must never be represented as live provider connectivity or a verified production budget.
- Application ledger limits do not imply control over account-wide Cloudflare AI Neuron usage or billing.
