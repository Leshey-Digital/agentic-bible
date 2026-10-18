# Implementation and verification

- [x] Verify clean isolated clone/branch from reviewed `b974c4c20621d7d869fc7a6cf15f4dc8bf89344a`; read repository guidance, decisions, workflow, product and existing hosted/integration contracts.
- [x] Add typed trusted-code adapter port and exact hosted API route; leave configuredPorts/RuntimeEnv and reviewed contract/identity/settings untouched.
- [x] Add test-only disposable memory composition, actual workerd default-entrypoint and signed route coverage; initial native tests passed 5/5 with no assets/outbound dispatch.
- [x] Document default closure, fixture/persistence limits, rotation adapter responsibility, scope and rollback.
- [x] Independent review reproduced encoded API-prefix aliases falling through to static assets. Reproduce native failure, add one-pass rejection of the decoded settings namespace without delegation, and cover encoded prefixes/slashes plus unchanged ordinary assets/malformed encodings. Clarify the original contract document's historical unmounted status versus this optional/default-closed route.
- [ ] Run focused contract/native/settings/hosted-identity checks and required full validate/dry runs, keeping check logs/status under the Git directory.
- [ ] Verify protected blobs and clean source checkpoint; report exact results, remaining gaps and independent review status.
- [ ] Obtain independent exact-head review; do not push/publish/PR/merge/deploy this checkpoint.
