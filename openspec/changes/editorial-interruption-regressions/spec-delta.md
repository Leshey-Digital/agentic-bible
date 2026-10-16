# Added acceptance scenarios

- Given a committed submission loses its response, reload and unchanged retry preserve all fields and the request reference, return the existing receipt with duplicate status, then clear the confirmed draft. Exactly one submission and one initial audit event exist.
- Given newer edits are entered while a committed response is held, reload before releasing it. Preserve every field and the original reference, reject the edited retry with 409 without adding records, then explicitly recover with a new reference. After another reload/save, exactly the original and newer records exist, each with one initial audit event and its own field values.
- Given Clear draft is clicked while a committed response is held without typing a replacement, completion must leave session storage absent and the form empty. Reload and a subsequent article link use their requested article defaults. Only the original saved record and one initial audit event exist.
- Keep PR #4's branch and reviewed candidate unchanged. Use actual local Worker/D1 persistence with deterministic response controls; do not alter production authorization or public-intake policy.
