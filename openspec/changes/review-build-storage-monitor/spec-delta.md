# Changed monitoring behavior

- A live enumerated descendant disappearing with ENOENT does not kill a valid owned review build. Preflight and root presence remain strict.
- Present bytes/file counts, symlinks, non-regular paths, directory type changes and unexpected filesystem errors remain fail-closed under existing limits.
- The first fatal stop is latched and cannot be erased by a later exit or timer. Preserve bounded, value-free structural reason/exit/signal diagnostics without overwriting files, following diagnostic symlinks or recreating missing roots.

# Acceptance scenarios

Actual one-byte cache-file churn before lstat completes the real Astro/Pagefind and signed-review flow and replays after D1 restart without another charge or effect. Real sparse-size and file-count breaches, cache/diagnostic symlinks, directory replacement and missing root still kill the child. Their safe journal/settlement state and bounded stop reasons remain available, including immutable error fallback when a record cannot be written.
