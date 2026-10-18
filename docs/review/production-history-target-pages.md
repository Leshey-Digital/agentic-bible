# Article-aware History pages

Implementation candidate on `feat/production-history-ui` from root preparation head `262857b7417591afa50fcf8ed89a37c88036dff7`. This is a separate clone and branch; the previously reviewed reader metadata branch remains unchanged.

The planned page adapter consumes the agreed `HistoryView` shape with `articleId`, per-article `current` state, a globally newest-first history list, and a review queue containing every current flagged item. Article names and reading links come from the compiled twenty-entry collection. The dynamic event path is `/history/{articleId}/{eventId}/`; it preserves the existing `/history/tool-use/{eventId}/` URL. Unknown targets fail closed, and every detail route stays noindex.

The actual native Git fixture and multi-article acceptance run are pending the production_quality generalized-history implementation. Do not report these UI contracts as verified until that fixture has two distinct article histories and per-article heads.
