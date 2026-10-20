# Spec delta: test process lifecycle

## Test fixture process ownership

Wrangler-backed test fixtures may use a Linux-only test supervisor to reap descendants adopted from Wrangler's owned session. The supervisor must signal only that session's process group, preserve the wrapped command's exit status, and finish bounded termination after timeout or interruption. Tests must verify unrelated processes remain alive through each scenario and must reliably clean up those test-created sentinels. Non-Linux platforms retain direct spawning. This mechanism does not claim to contain descendants that deliberately escape the owned session.
