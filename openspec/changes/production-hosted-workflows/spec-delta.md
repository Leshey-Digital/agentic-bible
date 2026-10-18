# Added requirements

- Shipped public intake stays closed unless trusted server policy supplies approved terms, privacy and moderation configuration. Client/env lookalikes cannot authorize it.
- Hosted inbox reads and writes directly verify configured signed assertions and same-origin controls; local sessions and legacy verifier callbacks are insufficient.
- Suggestions cover exactly the canonical reading inventory and persist only bounded validated plain text and source links. Contributed URLs are never fetched.
- Admin tags/dispositions use current revisions and audit history. An explicit reviewed correction note may bind only an eligible actual submission revision, and reuses the existing canonical GitHub draft proposal transport.
- Stale, rejected or changed bound submissions cannot authorize a proposal. Ordinary editorial writes never publish.
- Native tests use generated disposable identity/key/secret values and controlled transports only. Passing fixtures do not imply configured live service.
