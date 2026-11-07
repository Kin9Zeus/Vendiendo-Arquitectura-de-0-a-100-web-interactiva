# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting instead: **Security → Report a vulnerability** on this
repository, or write to contact@devleck.com. Include what you found, how to reproduce it
and the impact you think it has. You can expect an acknowledgement within a few days.

## Scope

- The assistant API under `server/chat/`: retrieval, prompt-injection guards and rate limits.
- The HTTP security headers and hash-based Content Security Policy in `server.mjs`.
- Anything that could expose a secret (environment variables, build output, git history).

## How secrets are handled

No secret is stored in this repository. Keys and tokens live only in the hosting platform's
environment variables, and environment files (`.env`, `.env.*`) are git-ignored. The
variables the project reads are documented in the README. Secret scanning and push
protection are enabled on this repository.
