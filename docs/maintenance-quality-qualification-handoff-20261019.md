# Maintenance quality qualification handoff

The exact-source qualification `c38ff50f-8919-4afb-929a-e42ce136eb51` ran commit `93ab982e017bc7346bee2327cd5092913bb6bbc7`. It passed earlier gates, then `test:maintenance-quality` failed 2 of 27 tests. No qualification receipt was created.

The preserved original suite log is at `.git/local-qualifications/c38ff50f-8919-4afb-929a-e42ce136eb51/logs/32.log` in the qualification clone. The bounded local-collection failure was `quality_accounting_unavailable` on a D1 insert; its retained SQLite file records nine completed admissions before the failed insert. The twenty-article test recorded `full_wiki_build_failed` with `exitCode: null`, `signal: SIGKILL`, `stop: child-exit`, and `lastPhase: history-complete` in `.git/wiki-bridge-test-quality-twenty-1/jobs/1eb83010fc41db657c6f2142ada8f895e400b03f114ea310a5e35c0cb35beac4/build-1-diagnostics.json`.

The maintenance-quality command now sets Node test-file concurrency to one. This preserves the same files, assertions, and test-level deadlines while avoiding parallel full-build fixtures. This checkpoint has had lightweight static checks only; it has not been tested at runtime.

Run only the two previously failing cases in the fresh checkout:

```sh
node --test --test-concurrency=1 \
  --test-name-pattern='bounded local collection publishes arbitrary supplied IDs past the compiled twenty|twenty actual quality-admitted producers' \
  tests/maintenance-quality/new-article-publication.test.mjs \
  tests/maintenance-quality/twenty-articles.test.mjs
```

Minimal checkout and dependency setup:

```sh
git clone --branch feat/d1-recovery-new-articles-20261019 https://github.com/Leshey-Digital/agentic-bible.git
cd agentic-bible
npm ci
```
