# Keep live storage monitoring correct under cache churn

Independent review of frozen PR45 found that a temporary file disappearing between enumeration and lstat triggers SIGKILL of an otherwise valid review build. It consumes a bounded attempt after canonical publication and leaves ingestion pending; its generic error discards the monitor's cause.

Tolerate only ENOENT for enumerated descendants in the live stage walk. Keep roots, other filesystem errors, symlink/type hazards, capacity and preflight/source checks strict. Latch and retain bounded structural stop diagnostics using safe exclusive/no-follow persistence and an immutable error fallback. Add real-filesystem, actual D1/Git regression and capacity/path controls without increasing any deadline or threshold. See [scope and evidence limits](../../../docs/review-build-storage-monitor.md).

Publish a separate successor from PR45 for exact-head CI and independent review. Currency/dispatch code remains unchanged. The separately reproduced cache-isolation checkpoint 6b14013 is not composed implicitly. Original historical errors cannot be conclusively attributed because their diagnostics were discarded. No paid call, credential, remote resource, merge or deployment.
