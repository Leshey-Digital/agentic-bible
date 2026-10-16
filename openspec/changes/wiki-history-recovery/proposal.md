# Preserve history text and account for interrupted captures

Independent PR17 review requested P2 history fidelity and P3 crash-leftover accounting fixes. Preserve PR17 `6f6fbd69bdaab9107f0eb88955d8da8bd1f3450d` and PR18 isolation successor `bf99ccc9bb8e5f3919de19fafd4461ab244bc63c`. This separate successor starts from PR18.

Rebase real internal href/src attributes and pin real href/src/action attributes while preserving prose, code, comments, raw-text bodies, other attributes, external URLs and fragments. Verify full native D1/current/publisher-history/canonical-history behavior through successor and rollback, with an actual HTML fixture for code (the Article schema has no code block).

Move captured projects into each owned bridge store under event/job/attempt-specific names. Retain interrupted diagnostics with conservative 64 MiB slot reservations and status reporting, inside the existing 192 MiB admission bound. Bound plan bytes and monitor live capture growth. Healthy finally removes only that invocation's capture. Do not sweep /tmp, infer ownership from a PID/site ID, or delete another operation's workspace. Explicit accounting is chosen over recovery deletion. No provider/resource/deployment or new infrastructure.
