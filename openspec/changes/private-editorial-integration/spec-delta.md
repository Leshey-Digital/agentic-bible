# Added private-inbox configuration

Given valid server admin trust, D1 and exact HOSTED_PRIVATE_INBOX=enabled, signed admins can access the existing inbox and review/history workflow without public intake policy. Anonymous submissions remain503; missing/invalid signed identity is rejected. The flag cannot replace trust/D1 or enable GitHub/provider credentials. Absent/malformed flag preserves current legacy behavior.

Acceptance: actual Worker with opt-in and no public intake settings rejects public submissions before and after a synthetic seeded contribution→signed review→controlled GitHub draft→D1 restart/history journey. No canonical write or paid dispatch becomes configured. Missing/invalid opt-in and trust remain closed. All prior contribution regressions pass unchanged.
