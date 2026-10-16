# Security

No deployed service or supported software release is established by this repository yet.

Do not put credentials, exploits containing private data, or sensitive incident details in public issues or PRs. A verified private reporting channel must be designated before public launch; none is claimed here. Until then, contact the project owner through an already verified private channel.

Implementation requirements:
- Secrets stay in approved secret stores and never in Markdown, client bundles, logs, or model prompts.
- Editorial sources, web pages, and submissions are untrusted. Sanitize rendering; reject executable content; protect URL fetching against SSRF, redirects to private networks, oversized bodies, and unsupported schemes.
- Use least privilege and explicit approval for credentials, account permissions, and integrations. Preview infrastructure must be isolated.
- Moderate submissions; apply payload/rate limits and bot controls. Prevent unauthenticated publishing, open redirects, and stored script injection.
- Pin dependencies, review updates, scan for secrets and vulnerable packages, and document incident handling before launch.
- Keep a known-good artifact and tested rollback. Do not copy real customer data into tests.
