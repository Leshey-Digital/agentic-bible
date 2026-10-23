# Google Search and public-content governance

Owner-directed standard, recorded 2026-10-23. Applies to Agentic Bible public pages, generated content, templates, assets and releases, from planning through maintenance. This record covers this repository only; it does not establish adoption in other projects or certify any existing page. Review the official guidance when planning a change and again when qualifying its release; record the review date and relevant URLs.

## Requirements and authority

[Google Search Essentials](https://developers.google.com/search/docs/essentials) distinguishes technical eligibility, spam policies and best practices. Compliance does not guarantee crawling, indexing, rich results, ranking or traffic. Google recommendations are not all minimum eligibility requirements. The owner adopts applicable recommendations as this project's quality baseline; assess applicability explicitly rather than claiming every Search feature is mandatory.

For pages intended for public indexing, verify public access without login, Googlebot crawl access, successful HTTP 200 responses and indexable content, with no accidental indexing exclusion. These are the scope of Google's [technical requirements](https://developers.google.com/search/docs/essentials/technical). Check actual responses as well as built files. Record intended exclusions separately. Keep staging/preview pages noindex and retain their access controls. Robots.txt alone is not an indexing exclusion or a privacy mechanism; a crawler must be able to fetch a page to observe noindex. Do not remove authentication to make an exclusion observable.

Enforce the full applicable [spam policies](https://developers.google.com/search/docs/essentials/spam-policies), including prohibitions on cloaking, manipulative links, doorway pages, keyword stuffing, malicious content and scaled content abuse. Neither automation nor human authorship excuses low-value content created primarily to manipulate rankings. Investigate hacked content, misleading functionality and abusive submissions. Qualify paid/sponsored links appropriately; never buy ranking guarantees or manufacture endorsements.

## Project quality baseline

Apply the [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) to every affected page/template:

- Use clear, accurate, page-specific titles and descriptions; organize readable text with meaningful headings. Do not enforce invented word counts, heading quotas or keyword density.
- Provide crawlable links with descriptive text and useful internal navigation. Verify important pages are discoverable and links resolve to intended destinations.
- Use consistent production URLs, canonical declarations and redirects. Check sitemap entries against intended indexable URLs and keep staging/private URLs out. Canonicals and sitemaps are not promises that Google will select or index a URL.
- Where images help the reader, provide relevant, accessible images with suitable alternative text and surrounding context. Do not require decorative images solely for SEO.

The project's editorial standard additionally requires claim-level sources, version/date context, honest uncertainty, original explanation or analysis, and correction history. Review factual accuracy and reader usefulness; passing metadata tests alone cannot establish either. Evaluate AI-assisted work to the same standard. Follow Google's [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): do not substitute rewritten source material, inflated length or changed dates for substantive value. Preserve the existing automatic-publication policy and its validation gates; this document does not introduce universal human prepublication approval or authorize a model/publisher.

Assess mobile reading, navigation, accessible interaction, HTTPS, loading, responsiveness and layout stability across representative pages. Avoid obstructive ads/interstitials. Use actual browser checks and appropriate performance measurements; distinguish lab results from field data. Google's [page experience guidance](https://developers.google.com/search/docs/appearance/page-experience) is not a mandate for a perfect tool score. Missing field data must stay unverified, with a follow-up plan, rather than being invented or treated as a failed numeric threshold.

Structured data is conditional on the feature: when used, it must accurately represent visible content and satisfy Google's [structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) and the applicable feature documentation. Validate syntax and required properties; never invent authors, reviews, ratings or credentials. Valid markup does not guarantee a rich result. A feature that is not used can be not applicable with a reason.

## Release and maintenance evidence

For each applicable area above, record: exact source/artifact and target; affected routes and representative coverage; guidance URL/date; check performed and evidence location; result; responsible maintainer and next action. Use exactly these result meanings:

| Result | Meaning |
| --- | --- |
| Passed | Identified check completed successfully; state precisely what it establishes. |
| Failed | Observed violation or failed check; retain evidence and required correction. |
| Unverified | Not run, inaccessible, unavailable data or inconclusive; state why and how it will be resolved. |
| Not applicable | Explain why the requirement/feature does not apply to this target. |

Do not release an affected public surface with known eligibility, spam, factual-integrity or applicable baseline failures. Unverified pre-release requirements block a readiness claim and dependent promotion. Evidence only obtainable after deployment, such as live-target checks or later Search Console/field observations, must have a named follow-up and response plan; never claim it passed beforehand. Preserve separate checks for intended private/noindex targets. Apply established rollback or correction procedures if live checks fail.

Reviewers must examine both content and technical evidence. Record sampling limits; a sampled check does not certify the entire site. Reassess after material content/template/routing changes and when guidance changes; track regressions and substantive corrections. Existing account permissions, budget limits, release approval and security controls still apply. This policy creates no credentials, analytics subscription, indexing submission or deployment authority.
