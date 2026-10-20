# Added: guarded editorial suggestion navigation

- Switching/reloading a suggestion with unsaved disposition, tags, review note, confirmation or uncertain review request requires explicit discard confirmation.
- Cancelling preserves selected suggestion, all fields and request identity, and sends no replacement detail read when cancellation precedes that read.
- If a reviewer changes fields while another detail read is pending, those changes require explicit discard before the response can replace the form.
- Failed detail reads preserve the current draft; a successful approved switch clears pinned-source/review authority for the newly selected suggestion.
- Already saved disposition or reviewed-note fields do not alone trigger an unsaved warning. No browser storage persistence is added.
