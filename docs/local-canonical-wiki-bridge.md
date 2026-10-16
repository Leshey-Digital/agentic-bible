# Local canonical wiki bridge

This separate successor starts from independently accepted PR16 `d0c80023b4ade29fad5eb77bcbdaae8ca08781c5`. It connects the existing actual local D1 HTTP observation tables, supplied-revision publisher and full Astro/Pagefind wiki. Only `tool-use` is writable through this bounded synthetic demonstration. It creates no public release or remote resource.

## Reproduce

Use the pinned Node 24.19.0/npm 11.9.0 environment and `npm ci`. Prepare two controlled original fixture observations once, explicitly:

```sh
npm run wiki-bridge:prepare
npm run wiki-bridge:apply -- --file fixtures/wiki-bridge/packet.json
npm run wiki-bridge:status
npm run wiki-bridge:local
```

Open `http://127.0.0.1:8793/articles/tool-use/`. The single **apply** command validates the bounded supplied files against successful charged actual local D1 receipts, invokes the existing publisher, builds an isolated full wiki and atomically activates it. Preparation is a separate test-only controlled collector; rerunning preparation replays its keys without extra fetches. The bridge itself performs zero source fetches and no D1 writes. Do not confuse controlled bytes attributed to a registry URL with authentic retrieved official documentation. The fixture says this explicitly and supplies no new AI facts.

`--state wiki-bridge-<name>` and `--observations wiki-observations-<name>` select separate owned stores in the actual Git directory; apply also accepts `--sources <directory>`. Defaults are `wiki-bridge-local` and `wiki-observations-local`. Preview is read-only and bound to 127.0.0.1, rejects a different Host, uses no-store/noindex/CSP, and offers `/bridge-status.json`. Canonical paths redirect to the current `/wiki-snapshots/<id>/` artifact. Navigation, assets, keyboard search and search results stay pinned to that snapshot, including older activated snapshots.

## Evidence and state contract

The complete envelope includes the exact original `tool-use.md` SHA-256, expected full-site reference, expected publisher reference and publisher base revision. Every source has an exact fixed registry ID/URL, a matching citation, a source filename/hash and an observation request UUID. Two or three bounded regular UTF-8 files must match successful HTTP job receipts and their successful charged reservations, attempt, recorded bytes and budget accounting. Missing, failed, uncharged, mismatched and 304-only records reject before publisher, build or journal effects. Store ownership markers and a mutex may exist after a rejected request. This is an integrity binding, not factual, authenticity, licensing or malicious-claim adjudication. A filesystem/database owner remains trusted.

After validation, the fsynced journal archives original evidence bytes and records the exact event fingerprint and captured build-source hash. Publisher acceptance is separately pinned and reported as **article-accepted/site-pending** until activation. That status is recovered even if the process died between publisher activation and journal update. A failed build leaves the previous whole site active. Retry only the identical event; a changed event under the same key conflicts, another pending operation blocks new work, and changed Markdown, build source, publisher base or site parent never silently rebase.

An isolated copy of `src`, `public`, pinned package/config files and the build child script receives the publisher's immutable article JSON as escaped Markdown/frontmatter. Original Markdown, ordinary `dist`, interactive `.wrangler/editorial` and legacy D1 tables are untouched. No source body is inferred or transformed into new article prose. Astro builds all canonical pages/catalog; publisher history and flags are materialized into the same artifact. Pagefind indexes only the three current canonical articles, excluding historical revisions. The site manifest hashes every output file and binds source hashes, publisher reference, parent/ancestry, accepted keys and revision evidence. A sealed orphan cannot be served. The fsynced atomic `current.json` replacement is the activation commit point.

Explicit rollback uses the same apply command with a `kind: rollback` envelope containing a new event ID, original Markdown hash, current expectedSite/expectedPublisher and `targetSite` equal to a recorded ancestor reference or `null` for the original Markdown baseline. It restores a complete wiki/search snapshot and retains accepted keys, article history, original evidence proofs and D1 charges/receipts. It adds a new site/publisher action rather than deleting prior actions. Old successful requests replay their historical receipt without changing the current site. See the executable [rollback/browser scenarios](../tests/wiki-bridge-browser/canonical.spec.mjs).

## Bounds and limits

Envelope: 49,152 bytes. Sources: 2–3, each 32,768 bytes. Captured project: 512 files/8 MiB. Full site: 1,024 files/16 MiB. Bridge store: 192 MiB conservative admission limit, separate from the existing publisher's 64 MiB limit. At most eight site operations, with the last reserved for rollback; at most three explicit build attempts per event. Each build has a 45-second child deadline; the CLI has a 110-second action deadline, and a child owner-death guard stops abandoned work. Dead-process staging directories are not automatically deleted; they count toward admission and should be preserved for investigation. Exhausted attempts/capacity leave explicit pending state requiring operator investigation, not automatic rebase or unbounded retry. These bounds are not currency caps.

This is one-host local filesystem/SQLite coordination. It does not provide source discovery, article generation, factual/authenticity or rights verification, a remote trusted distributor, cross-host locking, production identity, live schedules, a production restore plan or provider monetary enforcement. No credentials, paid calls, tracking, ads, license selection, main merge or deployment are part of the bridge. Existing release gates still apply. Earlier PR16/publisher documents describe their historical disconnected checkpoint; this bridge closes only the bounded supplied-content canonical integration gap.

Run `npm run test:wiki-bridge` (included in validate) and `npm run test:wiki-bridge:browser` for actual local workerd/D1, process death, real Pagefind and rollback. Run other browser suites sequentially. [Verification evidence](review/local-canonical-wiki-bridge.md) records exact observed results and remaining review status.
