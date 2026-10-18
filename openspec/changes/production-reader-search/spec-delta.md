# Specification delta

## Changed requirements

- Given a natural-language query that explicitly asks how to protect an AI agent from prompt injection or malicious retrieved instructions, if direct full-text search finds nothing, expand locally to the `prompt injection` keyword and identify that expansion in the status.
- Given a query that explicitly asks how to prevent repeated actions after an interruption, if direct search finds nothing, expand locally to `durable agent execution` and identify that expansion in the status.
- Given unrelated or ambiguous queries, do not apply either expansion.
- Given any result, render its excerpt as text and link only to same-origin article paths.
- Given slash on a non-editable page, navigate to search and focus its input; given slash while editing a field, preserve normal typing behavior.
- Given an empty, failed, stale, or JavaScript-disabled search, preserve the existing local browse and recovery paths.
- Given one topic entry, display “1 article”; given another count, display the appropriate plural.
