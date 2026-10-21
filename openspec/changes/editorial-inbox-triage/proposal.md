# Article and tag triage for the private editorial inbox

The approved roadmap calls for a usable editorial queue with independently editable tags. Editors currently can list only one disposition, even though suggestions span twenty articles and have tags. Add server-side article and exact-tag filters combined with disposition, with bounded keyset pagination and accessible controls. This is product functionality for finding relevant suggestions, not release/test infrastructure.

Reuse existing D1 tables, signed identity and UI. No migration, provider, credential, cost or public-intake change. Preserve unsaved open details when filtering the list. Branch starts from integration checkpoint de6589f; frozen PR56 and its prepared deployment remain unchanged.
