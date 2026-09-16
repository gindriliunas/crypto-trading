# Container hardening (Trivy findings and fix)

Trivy’s **container** job initially failed on the `node:22-alpine` runtime image. App npm packages in `dashboard/` were clean; findings were in the **base image**.

## Alpine OS (2 × HIGH)

| Package | CVE | Issue | Fix |
|---------|-----|--------|-----|
| `libcrypto3` / `libssl3` | CVE-2026-14456 | OpenSSL QUIC DoS (unbounded memory) | `apk upgrade --no-cache` in the runtime stage (`3.5.7-r0` → `3.5.8-r0`) |

## Bundled Node toolchain (1 × CRITICAL, 10 × HIGH)

Located under `/usr/local/lib/node_modules/npm/` inside the Node image — **not** used by the production Next.js standalone server (`node server.js`).

| Library | CVEs | Severity | Issue |
|---------|------|----------|--------|
| `tar` | CVE-2026-59873 | CRITICAL | DoS via crafted gzip bomb |
| `tar` | CVE-2026-59874, CVE-2026-73566 | HIGH | DoS via malformed / long-path archives |
| `brace-expansion` | CVE-2026-13149, CVE-2026-14257, CVE-2026-69152 | HIGH | DoS in pattern expansion |
| `pacote` | CVE-2026-9496 | HIGH | Vulnerability in npm package fetcher |
| `picomatch` | CVE-2026-33671 | HIGH | ReDoS via crafted extglob patterns |
| `ip-address` | CVE-2026-69192 | HIGH | Inconsistent IP parsing → SSRF risk |
| `sigstore` | CVE-2026-48815 | HIGH | Weak cert verification option handling |

## Remediation

In `dashboard/Dockerfile` runner stage:

1. `apk upgrade --no-cache` — patch Alpine OpenSSL  
2. Remove unused `npm` / `yarn` / `corepack` from the runtime image  

Commit: `60b11e9`.
