# Combine local HTTP observation and supplied publication checkpoints

Create a separate candidate with both exact source histories: PR10 d0bfca47cd221b970b01ace838afb3f3bb9a5d32; HTTP PR12 b78751b4f4db09fcce4289052f7e163ac4be9c5b; publisher PR11 efeffed9467a9fa67125725d923d6d672cfd9555 and topic fix PR13 d57e975253ba6d9ba3e48a2292611cfca14aa118. Preserve all source heads. Resolve only shared instruction/README/package overlap; retain additive migrations and all tests. No existing runtime transport or publisher implementation changes are intended.

Add a test-only controlled workerd/D1 collector and separately supplied validated-revision HTML/Pagefind preview journey, including restart, replay, rollback, source failures and no automatic publication on collection. The test must expose the absent bridge; it cannot claim source-to-generated article capability. Keep provenance separate and retain original content/state.

Run combined tests and legacy browser/restart checks sequentially. Publish a qualified draft under standing public-project authorization for independent exact-head review. PR13 full documentation review is still a separate gate; no candidate acceptance is inferred from source/test acceptance or CI. No main merge, deployment, live cron, credential, paid call or new cloud resource.
