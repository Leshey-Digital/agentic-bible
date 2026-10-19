# Specification delta

## Added requirements

- Astro reader inventory MUST accept canonical-schema articles with validated lowercase safe slugs independently of the fixed canonical writer inventory.
- Reader builds MUST reject duplicate article IDs/routes, colliding order values, malformed source anchors, self/duplicate related IDs, and unresolved related IDs before generating routes.
- Eligible validated reader articles MUST appear in static article routes, Pagefind, page-level structured metadata, indexing manifests, and canonical sitemaps.
- Non-eligible article routes MUST retain noindex headers and must not enter the public sitemap or indexing manifest.
- Test fixtures MUST remain outside production content and use an isolated temporary checkout.
- The fixed canonical writer and release-candidate twenty-source gate remain unchanged pending their separate review and integration.

## Acceptance scenarios

- Given a twenty-first valid Working draft record with a unique order and related-link target, when an isolated static build runs, then its article page, Git revision metadata, Pagefind inventory, structured metadata, indexing entry and canonical sitemap URL are generated.
- Given an unsafe slug, duplicate order, colliding ID, malformed source anchor or unresolved related link, when reader inventory validation runs, then the build stops with a stable inventory error before emitting discovery artifacts.
- Given a local publication or otherwise ineligible article, when a canonical static build runs, then the route receives a noindex header and is omitted from the sitemap and indexing manifest.
- Given 21 source Markdown records, when canonical release-candidate verification runs, then the separate fixed-twenty candidate gate still declines release pending canonical writer integration/review.
