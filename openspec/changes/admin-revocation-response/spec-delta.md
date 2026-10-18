# Proposed specification delta

- Given a completed proposal response held in transport, a later confirmed revocation and failed list reload, releasing the old response preserves the revoked state, latest feedback and disabled controls.
- Superseded success/error responses cannot replace newer row actions or mutate a detached row's current status. Cleanup cannot reenable a confirmed-revoked approval.
- Normal proposal replay/revocation and the previous delayed approval/list/input protections remain covered. Backend immutable authority and community review are unchanged.
- Regressions use the shipped Worker, real workerd/D1, generated signed assertions and controlled GitHub; no live proposal, release or credential is involved.
