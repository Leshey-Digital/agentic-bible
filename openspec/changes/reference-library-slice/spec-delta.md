# Proposed specification delta

- Reading: pre-render three interconnected Markdown entries with schema-validated metadata. Each displays authoring status, source-check date, independent review pending, primary citations and revision context. Source anchors and related links resolve.
- Search: generate Pagefind from article content only. A browser query produces local results, a helpful no-results state, or a recoverable index-loading failure. Query replacement cannot render a stale result. No search-service or inference call occurs.
- Navigation: readers can browse all entries and three topics, use keyboard focus/skip navigation, and read at mobile widths without horizontal overflow. Content remains available without JavaScript.
- Preview: noindex in HTML and response headers, disallow crawling, no public sitemap, staging canonical origin. Unknown routes produce a genuine 404. No production routes or resources are configured.
- Integration gates: no analytics, advertising, submissions, paid calls or autonomous publication are implemented. Existing founder direction and unresolved decisions stay intact.

These scenarios describe this feature branch. Acceptance/merge and deployment remain separate actions.
