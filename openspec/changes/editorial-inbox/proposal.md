# Local correction and editorial inbox slice

Stack on PR #2 at 9a24bb5 without modifying its branch. Implement a real local flow: correction/source form → validated, deduplicated local D1 record → authenticated local admin inbox → tagged review disposition and audit history.

Keep public intake closed pending terms, moderation/retention decisions and production identity setup. Local test identities are explicit fixtures restricted to loopback with a separate configuration; they are not production authentication. Remote/unconfigured admin and API paths fail closed. Do not deploy or provision a database, identity, persistent credential or paid integration.

This queue collects suggestions and post-publication follow-up. It is not an approval gate for all articles. Automatic article publication remains approved policy; the article-generation/publication pipeline is outside this slice. No email is sent to the designated editorial address.

Use Workers request handlers alongside existing static Astro assets, a storage port with a D1 adapter, SQL constraints, body/URL/plain-text validation, same-origin writes, bounded rate counters, deduplication, optimistic concurrency and an audit trail. Production authentication and secret-vault/analytics setup remain separate integration contracts.
