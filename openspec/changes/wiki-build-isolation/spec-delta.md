# Added isolation requirement

- Astro child cwd, prerender, Vite/cache and build output belong to its captured private temporary project. The caller checkout's `.astro`, Markdown, ordinary dist and interactive state remain unchanged.
- Hash/inventory and bound completed output before copying into bridge staging across filesystems; activation still requires the complete pinned manifest and parent checks.
- Concurrent independent bridge builds must not share/delete intermediate files. Existing process-death, replay/search/rollback and receipt/charge guarantees remain.
