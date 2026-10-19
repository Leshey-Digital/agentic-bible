# Proposal

Astro's article route and most reading components already use the content collection, but several reader-side discovery surfaces still derive their inventory from the fixed twenty-ID writer list. This blocks a valid twenty-first content record at build time or omits it from structured metadata and the canonical sitemap.

Validate article slugs, routes, unique order values, source anchors, and resolvable related IDs at the reader boundary. Build article pages, search, structured metadata, indexing manifests, and sitemap entries from the validated Astro collection. Keep the contribution/source-monitor choices and canonical writer on their fixed inventory; do not change the denied writer-review scope. The release candidate remains twenty-only until its separate canonical integration and review are completed.

The regression creates a temporary Git checkout, adds a schema-valid twenty-first Markdown record, and builds it with production discovery settings. The fixture stays outside the repository's production content directory and the test removes the temporary checkout afterward.
