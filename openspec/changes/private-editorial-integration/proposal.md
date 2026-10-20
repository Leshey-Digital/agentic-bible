# Private editorial staging integration

Consolidate deployed recovery ancestry and PR53/54 into one non-production checkpoint. The next meaningful milestone is a private staging trial of the full existing suggestion→review→draft→history workflow, while public intake stays closed.

Actual shipped configuration currently mounts the inbox only with approved public policy plus rate-key material. This prevents the planned private trial. A native Worker regression reproduces503 instead of the expected authorized inbox200. Add exact trusted-server opt-in HOSTED_PRIVATE_INBOX=enabled, behind the existing valid signed-admin trust and D1 gates. It supplies only trust to the existing contribution handler; intakeConfigured remains false without independent policy/rate authority. Absent/malformed opt-in preserves legacy standalone behavior.

No runtime binding is set remotely. No identity, credential, security configuration, D1 migration, public contribution, paid AI or activation is performed. Synthetic test records are inserted only in disposable local D1. Build an exact closed staging candidate and record real setup prerequisites; full saved-environment release qualification remains required before promotion.
