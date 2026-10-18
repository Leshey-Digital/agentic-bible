# Proposed delta

- Response sequence determines which read may update the view/status.
- A separate reload-operation sequence determines which completed operation may release Reload.
- A save may make a pending read stale without permanently disabling its recovery button. An older operation cannot unlock a genuinely newer reload.
- After a durable save plus failed follow-up read, newer draft/choice and confirmed save status remain intact. Reload is usable once its pending operation completes.
- A subsequent stale save retains the note, rejects without another D1 decision, disables Save until reload and leaves Reload usable. Reload plus explicit reconfirmation permits exactly one new intended decision.
- Tests hold responses only after actual Worker/D1 reads/writes, verify canonical/flag immutability and preserve desktop/mobile accessibility and width checks.
