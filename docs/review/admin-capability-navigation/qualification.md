# Capability navigation correction

Actual staging login established two defects: /admin/ served a maintenance form while its frozen catalog was disabled; navigation linked to GitHub-backed corrections while GitHub authority was intentionally absent. The authenticated private inbox itself works and currently has no suggestions across the four disposition views.

The correction keeps paths/workflows distinct. Signed /admin/ redirects to /admin/contributions/ when the inbox is configured. Maintenance pages validate the catalog before rendering a form and otherwise show an honest unavailable page. Inbox and maintenance navigation omit GitHub corrections links without the relevant authority. Authentication, private-source checks, mutation APIs, disabled public intake and paid AI remain intact. A cross-site guard was added before the new landing redirect after independent review found it missing.

Focused verification: 2/2 new native and 390/1280px keyboard/browser capability cases passed; 2/2 retained frozen-module parity and private-note save/replay/restart/browser cases passed. Astro checked 198 files with zero errors/warnings/hints; documentation validation passed. Original assertions and deadlines were not weakened. No unrelated full suite ran.

The first new-fixture run failed during incomplete disposable migration setup and was stopped through its known supervisor; it is retained locally. The fixture now includes the required correction table migration and disposes runtime on setup error. A bounded wrapper invocation exited at the supervisor parent guard before tests; its empty log is retained. The final focused run passed. No failed result was relabelled.

Independent reviewer accepted the source after the cross-site correction. Staging currently remains version 11e56042-5e04-4cd6-a136-f5d3f4abbe10, deployment cc3fd2aa-df84-44dc-8351-c1fabfba1368. These are the next update's expected-current and rollback pins. D1, inherited secrets and enabled private inbox must remain; public intake, GitHub and paid-AI policies stay absent. Access already uses 1h and requires no further change.

No provider update or fixture insertion is authorized by this checkpoint. Parent review and the ongoing real-browser trial precede staging activation. See the separate fixture proposal; the empty dataset is not a failure of inbox authentication.


Prepared source: `9efcb9e7247772286791be9e8fe5cd073f97ff94` (clean at packaging). Candidate manifest SHA256: `f6f7a6b39a1b8e72f67afb3fe67f3b6d778c9d31edfe2d408e6ac1934d145085`; compiled Worker SHA256: `c02ab0f388d08c60d23037abb44611ab07de4a9bd3327e83e054aa8d5f99ce50`. All 80 static Data modules and configuration hash are unchanged. Module package dry run passed (1613.30 KiB / gzip 520.03 KiB per Wrangler). [Deployment metadata](deployment-metadata.json) and [held plan](deployment-plan.json) preserve current staging bindings and use current v6 for secret inheritance and rollback. No inactive version was uploaded.

Fresh pre-push provider reads returned no build triggers for staging or production; repository executable Actions remain absent. Documentation-only evidence successors do not change the tested implementation or prepared package.

Independent final package review accepted candidate f6f7a6b3…145085: all 81 modules and upload bytes verified, all 80 static modules unchanged, D1 and three v6 secret inheritances preserved, private inbox retained. No new security finding; fixture proposal fingerprint and conflict/partial-state boundaries accepted. Upload, activation and seeding remain held.
