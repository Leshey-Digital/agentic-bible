# Wrangler child process supervision

## Problem

Wrangler-backed test fixtures can leave workerd descendants behind when a parent exits or a test is interrupted. A test-only Linux supervisor should reap only descendants in the Wrangler process group's owned session, while preserving worker-backed coverage and leaving unrelated processes untouched.

## Scope

This change is limited to test orchestration. It does not change application or release behavior. The helper is Linux-specific and test-only; other platforms retain direct process spawning. Escaped daemonizing descendants are outside the helper's ownership contract.

## Acceptance

- Normal exit, timeout/escalation, nonzero exit and spawn error return their expected statuses.
- The helper reaps every child in its owned process group and does not signal an unrelated live process.
- Wrangler-backed real Worker tests continue to use the helper.
- Focused and affected regression checks complete without adding workerd zombies or retaining live owned descendants.
