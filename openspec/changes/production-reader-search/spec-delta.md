# Specification delta

## Changed requirements

- Given a natural-language query that explicitly asks how to protect an AI agent from prompt injection, malicious instructions, or untrusted retrieved material, if direct full-text search finds nothing, expand locally to the `prompt injection` keyword and identify that expansion in the status. Generic “injection” wording alone does not qualify.
- Given a query that explicitly asks how to prevent repeated actions after a technical interruption such as a crash, failure, restart, timeout, or process exit, if direct search finds nothing, expand locally to `durable agent execution` and identify that expansion in the status. Ordinary “after” phrasing alone does not qualify.
- Given unrelated or ambiguous queries, including SQL injection and ordinary after-lunch phrases, do not apply either expansion. Preserve ordinary Pagefind matches, even when broad queries match many indexed entries.
- Given any result, render its excerpt as text and link only to same-origin article paths.
- Given slash on a non-editable page, navigate to search and focus its input; given slash while editing a field, preserve normal typing behavior.
- Given an empty, failed, stale, or JavaScript-disabled search, preserve the existing local browse and recovery paths.
- Given one topic entry, display “1 article”; given another count, display the appropriate plural.
