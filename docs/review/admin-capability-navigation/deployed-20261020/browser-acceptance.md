# Real authenticated private-editor acceptance — complete

This record preserves **browser observations reported by the parent thread**, not a new independent D1 read or a repeat test by this executor. The parent used the normal authenticated editor session. Exact values are in [browser-acceptance.json](browser-acceptance.json).

On staging version `7bf23d96-ec17-4ed0-a676-a2bc8d5922ef`, deployment `3c66f6b5-7835-40c9-9e55-00cc9cf60b40`, /admin/ redirected correctly to /admin/contributions/. The editor opened only the labelled synthetic tool-use fixture, loaded the pinned Markdown, changed its disposition to follow-up and saved the synthetic note with citation `openai`.

Review `ec7bce60-ef1a-4d4e-bb1f-e899df011a86`, revision 2, retained its exact note, citation, revision and identifier after a full page reload and reopening the fixture. UI audit displayed review-updated at 19:17:15.727Z and hosted-note-reviewed at 19:17:25.413Z on 2026-10-20. The submitted timestamp remains explicitly synthetic; it is not the actual insertion time.

The UI stated “No GitHub draft request recorded.” No article publication, GitHub draft, security change or production change occurred. Preserve the fixture, saved review and audit; do not reset or delete them.

**Bounded milestone complete:** normal authorized login → correct private inbox → pinned source review → saved note → persistent readback after reload. This establishes the private staging workflow for this synthetic fixture, not public contribution intake, GitHub publication, general production-editor acceptance or a successful original qualification-runner receipt.

The earlier deployment records retain their original pending-trial status as historical evidence. This dated browser acceptance resolves that boundary without rewriting those records. Evidence remains on integration/private-editorial-workflow; no main merge or runtime update accompanies this documentation checkpoint.
