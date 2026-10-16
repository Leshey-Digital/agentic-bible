# Non-deploying local integration candidate

Combine the independently accepted contribution-draft recovery/interruption fixes with the existing measurement/settings and source-monitoring stack on a new branch. Preserve every existing PR head. Start from PR #7 at `2254699fe4828f6ad11724a7f10c75e899609506`; apply PR #4 `3d98ef75679d855b1ffb5608014ccdf0c0c94669` and PR #6 `c61c576bf5455b20b01e1449330a85fe37386f45` as provenance-recorded commits.

The separately implemented PR #5 batch schedule/process replay fix must be independently reviewed at its exact published head before inclusion. Until then, batch replay is an explicit unresolved P2 and the candidate is incomplete. Verify migration upgrades from populated earlier schemas, combined correction/recovery → inbox → source ledger → settings/public privacy journeys, and existing security/cost bounds.

This is an integration test/review artifact. No merge into main, deployment, release approval, production identity, tracking, live fetching, provider credential, paid call or ad activation is authorized by it. Keep local interactive data. Publish a draft PR against the existing stack with exact provenance, test evidence, remaining MVP gaps and rollback instructions. Runtime functionality remains synthetic/local and the publication ledger remains metadata only.
