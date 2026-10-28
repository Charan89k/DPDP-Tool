# Security policy

CloudE5 holds personal-data compliance information for its customers, so security reports are handled
with priority.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Instead, use GitHub's
[private vulnerability reporting](https://github.com/Charan89k/DPDP-Tool/security/advisories/new)
for this repository, with:

- what is affected (page, API route or component) and the impact you see;
- steps to reproduce, or a proof of concept;
- any logs or screenshots (remove personal data first).

You can expect an acknowledgement within 3 working days and a status update within 10 working days.
Please give us reasonable time to fix the issue before disclosing it.

## Scope

In scope: this repository and the hosted service at [cloude5.tech](https://cloude5.tech).
Out of scope: denial-of-service and volume testing, social engineering, and findings that need a
compromised device or account.

## How CloudE5 is protected

Tenant isolation in the database layer, two-factor sign-in, rate limits, same-origin checks,
nonce-based Content Security Policy, virus scanning of uploads and encrypted transport throughout.
See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).
