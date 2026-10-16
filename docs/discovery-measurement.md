# Discovery, SEO and measurement policy

Required intent from the founder. The separate [canonical SEO/indexing slice](canonical-seo-indexing.md) implements local canonical/staging metadata, sitemap and a disabled bounded indexing outbox. No production origin, account, provider connection, submission or deployment is enabled; measurement remains unconfigured.

## Legitimate discoverability
Publish useful original synthesis backed by citations, semantic HTML, descriptive titles, stable canonical URLs, internal cluster links, accessible navigation, and accurate structured data matching visible content. Generate XML sitemaps containing only canonical public pages. Keep staging and previews out of indexing and sitemaps; check robots and noindex separately before launch.

Use redirects for moved pages, correct status codes, accurate modification dates, performance budgets, and readable metadata. Reject cloaking, doorway pages, bought link schemes, fake engagement, keyword stuffing, and mass thin content.

Use IndexNow only for participating engines and eligible URLs after ownership/key setup is approved and protocol support is verified. Do not describe it as a Google submission mechanism. Sitemaps and submissions do not guarantee indexing. Verify current first-party guidance during implementation.

## Measurement taxonomy
| Signal | Definition / source | Important gap |
|---|---|---|
| Public page view | privacy-reviewed aggregate request/client event | bots, blockers and consent affect counts |
| Article engagement | optional bounded aggregate read-depth or navigation event | not proof a person understood an article |
| Internal search | aggregate search use, no-results rate, result selection | avoid raw queries that may contain private data |
| Proposal funnel | aggregate opened/submitted/reviewed/accepted counts | no submitter identity in analytics |
| Google discovery | Search Console impressions, clicks, position, indexing where available | sampled/delayed data, account access needed |
| Microsoft discovery | Bing Webmaster metrics and submission responses | submission acknowledgment is not indexing |
| AI referral | recognized referrer category and landing page | referrers are often absent or ambiguous |
| AI citation visibility | documented, repeatable manual/provider-supported sample of prompts with date/model/region | sample observations, not universal rank or attribution |
| Crawl visibility | identified crawler requests, with identity confidence | a crawler visit does not establish training use or citation |
| Editorial freshness | verification age, broken sources, pending corrections | automated change detection is not factual validation |
| Cost and reliability | job counts, spend estimate/actual, failures, capped jobs | billing delays must be stated |

Use common dimensions: date, canonical article id, cluster, environment, coarse source/channel, schema version. Do not collect full IP addresses, persistent cross-site identifiers, raw search text, proposal bodies, or model prompts in analytics by default. Choose minimum aggregation, access controls and retention before collection; publish an accurate privacy notice and obtain required consent.

Every dashboard signal has an owner, definition, origin, last refreshed timestamp, retention, and status: measured / estimated / unavailable / not configured. Mark zero only for a measured zero. Never equate AI referrals, crawler requests, sampled citations, and total AI visibility.
