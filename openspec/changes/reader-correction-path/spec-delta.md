# Requirement changes

## Changed: reader correction status and context

- Article correction links must describe the currently available reader action accurately and carry the article identity to the noindex correction-options page.
- The correction-options page must identify its selected article and link to that article's cited sources and revision record.
- When no supported intake mode is explicitly enabled, the page must state that reader submissions are closed and that it cannot receive or send a report. It must not present an inactive form as an available reader action.
- Existing local synthetic and explicitly configured hosted contribution flows remain usable when their existing status checks enable them. Private editorial review remains limited to authorized editors.
- The correction-options page remains noindex and excluded from canonical URLs and sitemaps; article canonical metadata and sitemap eligibility remain unchanged.

Acceptance scenarios:
- From an article, correction guidance names closed reader intake and offers direct links to the cited sources and revision record.
- Opening correction options with a valid article ID identifies the matching article and links to its source and revision sections; an invalid ID is not used to construct a link.
- With no intake status or a closed status, the article selector and submission fields are not exposed as an available form.
- With the existing local synthetic or configured hosted status, the matching existing form appears and retains its current behavior and policy links.
- No article Markdown, SEO discovery eligibility, public authority, or private/admin indexing rules change.
