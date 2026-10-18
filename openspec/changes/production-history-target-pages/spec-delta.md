# Specification delta

## Added requirements

- History entries identify their compiled article target. The landing page resolves each entry and review flag to the real article title and reader route, preserves globally newest-first order, and labels current state per article.
- Revision details use `/history/{articleId}/{eventId}/`; the existing Tool use URL remains available at its same path. A record targeting an unknown article fails the build rather than receiving a guessed title or link.
- Empty history explains that no maintenance records are included in the edition and does not imply that an article has never changed.
- History and detail pages describe Git integrity as byte/record provenance only. They do not imply factual accuracy, source authenticity, or editorial certification. Event detail pages remain noindex.

## Acceptance scenarios

- Given two articles with separate recorded histories, the History stream shows both titles, links each event to its own article-aware detail path, preserves global order, and labels each article's current head separately.
- Given current review flags on more than one article, History and Review show every flagged article with its real title, current reader link, and matching detail route.
- Given a receipt with an article identifier absent from the compiled collection, the static build fails closed.
- Given an edition with zero maintenance receipts, History shows an explicit empty-state explanation and emits no fabricated event pages.
- Given a Tool use receipt, its existing `/history/tool-use/{eventId}/` URL still resolves, while detail records remain noindex.
