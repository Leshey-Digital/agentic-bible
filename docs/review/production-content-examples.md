# Focused content corrections and worked examples

Prepared 2026-10-18 on `feat/production-content-examples`, starting at `f020a677ceeb0afc00fe2f39dc999dc11bdfc257`. The assigned base and reviewed source heads are preserved. Read-only remote observation reported main `b41a422881921638833f92b2361a70eb1647d01f`; this component does not rebase, push or change it.

The owner authorizes content fixes and substantive examples within the existing twenty canonical identities. This component changes only agent evaluation, human oversight, tool use and structured outputs, plus its focused tests and records. All twenty articles received internal/external deep reads; only sampled claims were independently checked. This record establishes neither universal factual verification nor human approval of these edits. Original source-review history remains separate.

## Source evidence

All checks below were read-only on 2026-10-18. Short paraphrases and source locations are retained; no full copyrighted source copies are committed.

| Primary source | Location checked | Bounded finding |
| --- | --- | --- |
| [τ-bench v1 PDF](https://arxiv.org/pdf/2406.12045v1) and [version record](https://arxiv.org/abs/2406.12045v1) | Section 3 begins printed p. 3 (PDF index 2); task instances, reward and pass^k are on printed p. 4 (index 3); estimators continue on printed p. 5 (index 4), before section 4. Version record: 17 June 2024. | Setup/reward/consistency belongs to section 3, not section 2. Only this annotation is changed in agent evaluation. The version record also supports the structured-output example’s 2024 year; 2023 is deliberately false. |
| [JSON Schema Core 2020-12](https://json-schema.org/draft/2020-12/json-schema-core) | Sections 8.1.1, 10.3.2.1 and 10.3.2.3 | `$schema` identifies the dialect; properties and additional-property rules support the displayed application contract. |
| [JSON Schema Validation 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation) | Sections 6.1.1, 6.2.2, 6.2.4, 6.3.2, 6.5.3 and 7.2 | Type, bounds, nonempty strings and required fields support the example. Format annotation and optional assertion support remain distinct. The example does not depend on `format`. |
| [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) | Function-call/output examples using corresponding `call_id` | Application execution and result correlation support the surrounding explanation. The article’s new envelope is explicitly generic, not an API payload. No model call is made. |
| [MCP tools, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) | Error Handling; Security Considerations | Protocol errors and `isError` tool-execution results are distinct; server input/access checks and client timeout/result checks are specified. Generic `status` fields are not presented as MCP shapes. |
| [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | Supported schemas; refusal and incomplete-response handling | Provider subset restrictions and alternate failure paths remain explicit. The schema is an application-level Draft 2020-12 example, not a guarantee that every API/model accepts its keywords. |

Human oversight receives a grammar-only correction: “the linked paper’s guideline discussion addresses …”. No new research claim or source-check date is asserted there. Existing article-wide source dates remain historical rather than implying a fresh full recheck.

## Verification and limits

Passed on content checkpoint `47fc752` (the final handoff records the subsequent documentation checkpoint and exact-head rerun):

- `python3 tests/content-readiness/examples_test.py`: 5/5 checks passed.
- `npm run test:docs`: 312 Markdown files, 376 relative links, no missing targets or conflict markers.
- `npm run check`: 158 files, zero errors, warnings or hints.
- `npm run build`: Astro build and Pagefind index passed; all twenty article pages indexed.
- `npm test`: 9/9 generated static checks passed, including route/fragment/citation links, twenty-entry inventory, provenance, disabled intake and staging exclusion.
- Inventory comparison against the assigned base: all twenty canonical filenames and top-level article metadata unchanged; exactly four authorized articles changed, with the other sixteen blobs unchanged. `git diff --check` passed.

The first Astro invocation, before committing article edits, stopped with `release_source_article_changed`, as required by the existing commit-pinned source guard. Committing the content checkpoint resolved the prerequisite; no guard was changed. An initial documentation command’s log redirection ran before its evidence directory existed; the completed rerun above passed. No content/test assertion failure remains.

Private command logs, preservation hashes and short source-location evidence live under `.git/production-content-evidence`. Full `npm run validate`, browser/native suites and deployment dry runs were not run by this component; the parent coordinates complete combined qualification and any shared browser ports.

The focused command is `python3 tests/content-readiness/examples_test.py`, using already available Python jsonschema 4.26.0. It checks the actual Markdown snippets with a Draft 2020-12 validator, malformed JSON rejection, required/extra/type/boundary cases, the false year’s continued schema validity, and correlation of the generic tool request and alternative results. It is not an executor or API integration test. No npm dependency or package script is added.

The parent owns complete combined qualification and desktop/mobile review of the combined result. This component does not establish live provider behavior, factual correctness of every article, independent editorial approval or production release readiness. No credential, live route, GitHub Actions workflow, backend/configuration, paid call, deployment or external write changes.

Rollback is reverting this component’s commit. It restores the four previous article versions without rewriting their history or changing the other sixteen article files.
