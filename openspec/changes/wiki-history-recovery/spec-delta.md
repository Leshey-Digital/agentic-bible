# Review fixes

- URL rewriting only changes actual intended URL attributes. Literal `/local-publications/`, code `fetch("/local-publications/")`, attribute-looking text, external URLs and source fragments preserve bytes in retained history; current and retained canonical revisions remain faithful through successor and rollback.
- Captures live inside the owned bridge root, bind event/job/attempt metadata and remain visible/accounted after process death/recovery. Every retained slot reserves 64 MiB in status/admission; no new operation bypasses capacity by leaving global temporary projects.
- Healthy cleanup removes only its own invocation's capture. Recovery does not delete retained captures or sibling stores, including another active store with identical inputs/site identity. No global sweep or PID/site-ID ownership inference.
- Preserve existing expected-parent, replay, charge/receipt, canonical search, interruption and rollback guarantees; independent exact-head review remains required.
