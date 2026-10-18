# Article-aware History pages

The current static History and review pages hardcode Tool use, even though the controlled build is expanding to a bounded set of article histories. Render the global revision stream against the compiled twenty-article inventory, resolving each record's target to its real article title and current reading route. Each current marker is per article; the overall stream stays globally newest-first.

Move the detail page to `/history/{articleId}/{eventId}/`. The existing Tool use URL remains identical under the new dynamic route. Unknown article targets must fail closed instead of being rendered under a guessed title. Keep every event page noindex and preserve the current History landing page discovery policy.

Show current review flags for every article, link to actual article pages, preserve text comparison/receipt labels, and state that Git record integrity does not prove factual accuracy or source authenticity. Use the existing cream/green serif reader design and native Astro stack. Do not change catalog contracts, maintenance validation, source content, SEO, or shared layout.
