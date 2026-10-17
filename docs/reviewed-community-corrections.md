# Local reviewed community corrections

The existing inbox stops at disposition/audit metadata; it does not publish canonical text. This separate successor preserves PR27 `d3c80414634480fdf479131bd96e490c58b1d1a0` and connects one **tool-use correction-note** path to the existing publisher and complete Astro/Pagefind snapshot builder. It adds no encyclopedia articles, public intake, production identity, source fetching, paid calls, live indexing, credentials, licenses, merge or deployment.

## Run the bounded local workflow

Use pinned Node/npm and `npm ci`, then `npm run validate`. With port 8788 free:

```sh
npm run corrections:local
```

Use only synthetic text at `http://127.0.0.1:8788/contribute/?article=tool-use`. Select the existing local editor fixture at `/admin/sign-in/`, open the submission in the existing inbox, and choose **Review canonical correction**. An ordinary disposition change still does not publish. Write an approved plain-text correction note, choose one of the original three citations, explicitly acknowledge review and choose **Approve and publish correction**. Contributor text is shown separately and is not prefilled or copied into the approved note. The submitted URL is never fetched or treated as supporting evidence automatically.

A completed suggestion is resolved with an audit event. To approve an additional note for that suggestion, deliberately reopen it in the inbox. The review page exposes historical receipts and an explicit **Restore original article** action. That action makes a new whole-site baseline snapshot while retaining corrections/history. Retrying an earlier completed approval returns its historical receipt without reactivating it after rollback.

The current local canonical routes are `/articles/tool-use/`, `/search/` and `/history/`; navigation pins to immutable `/wiki-snapshots/<id>/` artifacts. The other nineteen entries remain in the complete collection. The original Markdown files and ordinary `dist` are unchanged by correction operations. Canonical original prose/code remains intact; notes append in a distinct section. An opaque contribution reference, submission revision, local reviewer and approval ID provide attribution without pretending the contributor has an authenticated real-world identity.

`npm run corrections:local -- <name>` uses separate owned roots in the actual Git directory: `corrections-<name>` (D1), `wiki-bridge-corrections-<name>` and its derived article-publication store. Named stores reopen on restart; no automatic deletion or sweep occurs. Interactive `.wrangler/editorial`, existing source-monitoring tables/stores and other test roots are not reset. The ordinary `editorial:local` and static staging configurations do not enable this coordinator.

## Review authority and safety boundary

The coordinator embeds the existing Worker in local Miniflare/workerd/D1. Every publication/rollback/retry requires its existing admin session, an exact loopback Host/origin, same-origin request, CSRF and an explicit action. Local reader/anonymous identities and client-supplied role fields grant no authority. These ephemeral fixture sessions are **not production authentication**. Redirects are forwarded unchanged so the browser receives the session cookie; review forms use same-origin referrer policy while enforcing the original strict Origin and CSRF checks.

Migration 0007 adds `correction_operations`; it does not provision remote D1. Approval is immutable and binds the submission/revision, admin reviewer, reviewed note/citation, original Markdown hash, captured source hash, complete current-site/publisher references and expected publisher revision. A prepared D1 batch admits the approval, advances the submission version and records `correction-approved` together. Concurrent or stale approvals cannot both win. While approved work is pending, the correction-mode editorial SQL update adds a transactional `NOT EXISTS` guard, so ordinary disposition updates cannot invalidate the frozen decision or add phantom audit events.

The existing publisher accepts the supplied technically validated note revision, then the existing full-site builder escapes it and appends it to the unchanged article baseline. The canonical article and full retained history show credit. The original HTML archive must have prose identical to the isolated build's unmodified prefix; stale ordinary output fails closed. Retained correction histories combine that complete original prose and source list with the exact old note revision. History is excluded from Pagefind; current twenty-entry search reflects active notes. Source-check dates stay those of the baseline, rather than being invented from the admin action. No source-monitoring receipt is manufactured: the separate reviewed adapter validates actual D1 approval. The original HTTP-receipt entry point rejects correction credit metadata without this authority.

Approval establishes an authorized local editorial action, not factual accuracy, source authenticity, legal rights or a production identity. The original autonomous article-publication/post-publication-flag policy remains unchanged; explicit prepublication approval here applies specifically to community correction notes.

## Interruption, retries and bounds

The stores do not claim a distributed transaction across D1 and the filesystem. A crash can leave approval pending, **article-accepted/site-pending**, or **site-active/audit-pending**. Publication and activation use the existing fsynced journal/mutex/atomic pointer. Completion marks the D1 operation complete, resolves the suggestion and records `correction-published` or `correction-rolled-back` in one D1 batch. If completion fails, preserve the approved operation and retry its same reference; never invent a new key or rebase onto changed content. An unchanged completed retry has no new domain/audit effects; changed reuse conflicts.

HTTP input is capped at 8 KiB; reviewed note 20–1,000 plain-text characters; only the existing three citations; at most six active notes. D1 holds at most eight immutable operation receipts / 32-KiB commands, with no eviction; apply admission reserves the final site operation for rollback. Existing publisher/site limits remain: eight site operations, three explicit build attempts, 45-second build deadline, 64-MiB capture accounting, 192-MiB bridge bound and 32-KiB V1 catalog. These are software/local-test bounds, not filesystem quotas or currency enforcement. Exhausted attempts, changed sources, stale bases or capacity leave explicit pending/error state requiring investigation. There is no automatic retry loop or paid/provider call.

All new publication output stays synthetic/noindex, without public sitemap/outbox entries. Source transport, request/day/retry, measurement and ad settings remain unchanged. The Node coordinator makes only an owned loopback preview request; embedded Worker outbound networking is blocked. Community URLs stay inert.

## Validation, rollback and remaining work

Run `npm run test:corrections` (included in validate) and `npm run test:corrections:browser`, followed by retained suites sequentially. The new browser suite owns port 8788 and its uniquely named disposable stores; it checks desktop/mobile, actual submission/admin review, conflicts, denied access, attribution, preserved prose/code, real current/historical Pagefind, lost responses, restart and rollback. Native checks use actual workerd/D1, injected transactional faults, competing approvals, pending-review locks, exact replay, restart and SIGKILL. Source/package edits during these tests correctly invalidate captured source pins; freeze code first.

This is an explicit bounded local path, not a generic Markdown editor or production publisher. Other article IDs, arbitrary rewrites/new citations, verified contributor identities, production IdP/authorization, legal submission terms, artifact distribution/Git integration, robust operational recovery/retention and launch review remain separate work. Licenses and provider currency enforcement remain unresolved; public intake and live provider connections stay disabled.

Code rollback returns to the preserved PR27 head; new owned local stores should be retained/exported deliberately rather than silently pruned. Migration 0007 is additive; ordinary legacy local flows ignore its table unless the explicit correction mode is enabled. Do not apply a remote migration or delete interactive data as part of rollback. [Change proposal](../openspec/changes/reviewed-community-corrections/proposal.md) and [verification handoff](review/reviewed-community-corrections.md) record scope and results.
