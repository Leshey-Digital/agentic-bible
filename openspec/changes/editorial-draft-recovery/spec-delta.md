# Changed requirements

- Given a suggestion commits while the reader edits the still-visible form, its successful response clears only the submitted snapshot. Newer field values survive the response and a reload, using a distinct request reference for their later submission.
- Given a save commits but its response is lost, an unchanged retry remains replay-safe. If the reader edits the retained draft and receives a request-reference conflict, an explicit action issues a fresh reference while preserving every draft field. The action, current draft and chosen reference survive reloads.
- Given a reader deliberately clears/starts a draft while another save is pending, completion of that earlier save must preserve the new draft and its reference.
- Regression evidence must forward the original submissions to actual local Worker/D1 storage before holding or dropping their responses, and verify original/recovered records and audit counts. Production authorization and public intake remain unchanged.
