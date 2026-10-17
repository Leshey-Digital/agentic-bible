# Changed requirements

- A valid persisted schemaVersion 1 site remains readable after the live article registry, content schema or monitoring catalog validator changes. Interpret its layout using its own bounded, hash-bound V1 catalog. Never rewrite sealed bytes to upgrade it.
- Require exact equality between declared article routes and inventoried canonical article pages, including the frozen original three core articles, plus stable reading/search/catalog/Pagefind/history/review files. Preserve reference hashes, full inventories, ancestry, safe paths and tamper rejection. Unknown catalog versions and malformed layouts fail closed.
- Current/status, current and pinned HTTP pages, history and Pagefind continue serving actual old-runtime artifacts. Accepted old and current receipts replay exactly with zero calls to the supplied D1 capability, without reactivation or publisher/job/pointer mutation.
- Fresh builds include today's complete catalog. New or pending commands with changed source code still return `build_source_changed`; compatibility is only a read/replay guarantee.

## Acceptance scenarios

1. Execute immutable PR21 `c3d1d7a47e55862c53840d52ad4c71631bd9ad9e` to prepare charged evidence and activate two three-article sites. Retain both site/publisher stores and observations. Upgrade to this reader: status/current are identical, HTTP remains 200, history/search work, receipts match and the D1 capability is untouched.
2. Build an eight-article current site. In a separate copy, evolve live article/content/source schemas so the legacy catalog fails today's validator. Both persisted generations remain readable/replayable. New and saved pending commands fail with `build_source_changed`.
3. Tamper with bytes, remove declared legacy or new article output, add an undeclared page, duplicate/escape an ID or change catalog version/shape. Reject the site, including resealed malformed manifests; corrupt active HTTP returns 503 without falling back. Restore fixture bytes and confirm original inventories, publisher jobs, pointers, Markdown and ordinary dist remain unchanged.
