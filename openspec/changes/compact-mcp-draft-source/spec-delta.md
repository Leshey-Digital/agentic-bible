# Added requirements

- Compact source acquisition uses a distinct registered transport identity bound explicitly to the existing canonical article citation; request input cannot choose an arbitrary URL.
- Evidence represents a named complete section with exact raw byte provenance and hash. Reject missing, repeated, malformed or oversized sections without truncation.
- Raw download, evidence and whole-prompt token bounds remain enforced before AI dispatch.
- A terminal source-size failure is displayed as a pre-model rejection. The retained failed job is not retried or reset.
- A model or persistence failure must not be described as proving that no model call occurred.
