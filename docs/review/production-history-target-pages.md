# Article-aware History pages

Implementation candidate on `feat/production-history-ui` from root preparation head `262857b7417591afa50fcf8ed89a37c88036dff7`. This is a separate clone and branch; the previously reviewed reader metadata branch remains unchanged.

The planned page adapter consumes the agreed `HistoryView` shape with `articleId`, per-article `current` state, a globally newest-first history list, and a review queue containing every current flagged item. Article names and reading links come from the compiled twenty-entry collection. The dynamic event path is `/history/{articleId}/{eventId}/`; it preserves the existing `/history/tool-use/{eventId}/` URL. Unknown targets fail closed, and every detail route stays noindex.

The generalized HistoryView was integrated at `e3f7061c31f0207ea0a838f4c42e3213770e4526`. The native acceptance test runs one real controlled Git/D1 fixture for separate current heads in Tool use and Model Context Protocol, then builds Astro from the exact second commit. It verifies newest-first ordering, both article titles/reader links and event routes, current markers for both heads, both current review targets, schemaVersion 2, and staging noindex/no-canonical behavior for the History index and detail pages. The zero-history build test also verifies that an empty edition creates no event routes or fabricated records.

Both history-target tests, Astro diagnostics, static build, and docs validation pass on the prepared branch. This is controlled local preview evidence; it does not establish public deployment, factual accuracy, or editorial certification.
