# Cyber Essentials readiness (v3.3)

Organisation checklist against [NCSC Cyber Essentials Requirements for IT Infrastructure v3.3](https://www.ncsc.gov.uk/cyberessentials/resources) (effective 27 Apr 2026).

Related: [ISO 27001](./ISO27001.md) · [HLD](./hld.md) · [Firewall rules](../azure/FIREWALL_RULES.md)

**Scope note:** Certification covers the **whole organisation** (devices, home working, and all cloud services). This repo evidences the Azure paper-trading stack and GitHub CI. Device and SaaS MFA items require operator action outside Terraform.

**Auto-fail hotspots:** MFA missing on cloud services that support it; critical/high updates not applied within **14 days**.

Status key: **Aligns** | **Partial** | **Gap** | **Org** (operator device/SaaS evidence)

---

## Scope and assets

| Requirement | Status | Evidence / action |
|-------------|--------|-------------------|
| Defined scope boundary | **Partial** | See [Scope statement](#scope-statement) below — complete locations/devices before assessment |
| Asset inventory | **Partial** | See [Asset inventory](#asset-inventory) — keep current |
| Cloud services in scope | **Partial** | Azure, GitHub, GoDaddy listed; add email and any other SaaS |
| End-user devices in scope | **Org** | Complete [Device controls](#device-controls-org) |
| Backups (recommended) | **Partial** | Postgres Flexible Server default backups (`backup_retention_days` in Terraform); document restore drills |

### Scope statement

| Field | Value |
|-------|--------|
| Organisation / business unit | Crypto trading paper-dashboard (update legal name) |
| Network / cloud boundary | Azure subscription hosting `crypto-trading-*` resource groups; GitHub `gindriliunas/crypto-trading`; DNS `gindri.com` / `dev.gindri.com` |
| Physical locations | Primary operator workstation(s) + home working (list addresses before CE submission) |
| In scope | Azure Container Apps, ACR, Postgres Flexible Server, Log Analytics; GitHub Actions; GoDaddy DNS; operator devices used to administer the above |
| Out of scope (justify to CB) | None by default — keep cloud inventory current |

### Asset inventory

| Asset | Type | Owner | Notes |
|-------|------|-------|-------|
| `crypto-trading-dev` (and staging/prod RGs) | Azure PaaS | Org | Container Apps, ACR, Postgres, logs |
| `dev.gindri.com` | Public web app | Org | Custom domain → Container Apps |
| GitHub `crypto-trading` | SaaS / CI | Org | Source + Actions |
| GoDaddy DNS | SaaS | Org | Zone for `gindri.com` |
| Azure / Entra admin account(s) | Identity | Org | **MFA required** |
| GitHub account(s) | Identity | Org | **MFA required** |
| Operator laptop / phone | End-user device | Org | Firewall, lock, malware — see device checklist |

---

## Alignment by Cyber Essentials control

### 1. Firewalls

| Requirement | Status | Evidence / gap |
|-------------|--------|----------------|
| Device host firewalls | **Org** | [Device controls](#device-controls-org) |
| Only necessary inbound cloud services | **Partial** | Container Apps: HTTPS only. Postgres: Azure services rule + optional CIDR allow list — [firewall register](../azure/FIREWALL_RULES.md) |
| Document / approve inbound rules | **Aligns** | [azure/FIREWALL_RULES.md](../azure/FIREWALL_RULES.md) |
| Strong admin secrets / no open firewall admin | **Partial** | Terraform random DB password; Azure Portal MFA is **Org** |
| Software firewall on untrusted networks | **Org** | Device checklist |

### 2. Secure configuration

| Requirement | Status | Evidence / gap |
|-------------|--------|----------------|
| Remove unnecessary software | **Partial** | Runtime image strips npm/yarn ([dashboard/Dockerfile](../dashboard/Dockerfile)) |
| Non-default secrets | **Aligns** | Terraform `random_password` for DB + JWT |
| Authenticate before data access | **Aligns** | JWT cookie auth ([dashboard/lib/auth.ts](../dashboard/lib/auth.ts)) |
| HTTPS / TLS | **Aligns** | Container Apps + custom domain; Postgres `sslmode=require` |
| Secure cookies | **Aligns** | `httpOnly`, `sameSite=lax`, `AUTH_COOKIE_SECURE=true` |
| Device lock / auto-run | **Org** | Device checklist |
| Key Vault | **Aligns** | DB URL, JWT, invite in Key Vault; Container App uses managed identity secret refs |

### 3. Security update management

| Requirement | Status | Evidence / gap |
|-------------|--------|----------------|
| Supported software | **Partial** | Track Node/Alpine/Azure EOL |
| Auto-updates where possible | **Partial** | Azure PaaS by Microsoft; app image on deploy |
| Critical/high within **14 days** | **Aligns** (process) | See [14-day patch SLA](#14-day-patch-sla); Dependabot + Trivy gates |
| Remove unsupported software | **Partial** | Dockerfile base upgrades on rebuild |

### 4. User access control

| Requirement | Status | Evidence / gap |
|-------------|--------|----------------|
| Unique credentials | **Aligns** | Per-user email in Postgres |
| Account create / approve | **Aligns** | Signup requires invite code (`SIGNUP_INVITE_CODE`) |
| Leavers / inactive disable | **Partial** | `disabled_at` on users; disable via SQL (see below) |
| **MFA on cloud services** | **Org** | [MFA checklist](#mfa-checklist-org) — **auto-fail if skipped** |
| Separate admin accounts | **Org / Partial** | Azure SP for CI; humans must not use admin for daily browse |
| Password policy | **Aligns** | Min **12** characters + common-password deny list |
| Brute-force protection | **Aligns** | Lockout after **10** failures / 15 minutes |
| No forced password expiry | **Aligns** | Not enforced |

### 5. Malware protection

| Requirement | Status | Evidence / gap |
|-------------|--------|----------------|
| Anti-malware or allow-listing on devices | **Org** | [Device controls](#device-controls-org) |
| Cloud / container posture | **Partial** | Non-root container; Azure shared responsibility; enable Defender recommendations in Portal |
| Restrict untrusted execution | **Partial** | Non-root runtime user `nextjs` |

### Supporting DevSecOps (helps CE; not a substitute)

| Control | Status |
|---------|--------|
| SAST (CodeQL) | **Aligns** |
| SCA (Trivy fs) | **Aligns** |
| Secrets (Trivy + Gitleaks) | **Aligns** |
| Terraform IaC (Trivy) | **Aligns** |
| Container image (Trivy) | **Aligns** |
| DAST (OWASP ZAP after deploy) | **Aligns** |

---

## MFA checklist (Org)

Complete and tick before Cyber Essentials submission. Missing MFA on any cloud service that supports it is an **auto-fail**.

| Service | How to enable | Done |
|---------|---------------|------|
| **Microsoft Entra / Azure** | Entra ID → Users → Per-user MFA **or** Conditional Access requiring MFA for all admins; Security defaults ON for small tenants | [ ] |
| **GitHub** | Settings → Password and authentication → Enable two-factor authentication (TOTP or security key); require 2FA for org if applicable | [ ] |
| **GoDaddy** | Account → Security → 2-step verification | [ ] |
| **Email** (Microsoft 365 / Google / other) | Enable 2FA/MFA for every mailbox used for business | [ ] |
| **Any other SaaS** (banking, domain privacy, etc.) | Enable MFA wherever offered | [ ] |

**Admin hygiene**

- [ ] Separate day-to-day user account from Azure/GitHub **admin** account  
- [ ] Do not browse email/web while signed in as admin  
- [ ] Prefer Azure login as user + SP for CI (already used by Actions)  

---

## Device controls (Org)

For every laptop/phone that administers Azure, GitHub, or the app:

| Control | Guidance | Done |
|---------|----------|------|
| Host firewall ON | Windows: Windows Defender Firewall enabled on private/public profiles | [ ] |
| Device lock | PIN/password/biometric; lock ≤5 min idle; ≤10 failed unlock attempts (or vendor default) | [ ] |
| Disk encryption | BitLocker (Windows) / FileVault (macOS) | [ ] |
| Malware protection | Windows Security / Defender real-time protection ON **or** documented application allow-listing | [ ] |
| Auto-run disabled | No auto-exec of removable media; browser safe defaults | [ ] |
| OS + apps patched | Automatic updates ON; critical/high within 14 days | [ ] |
| Software firewall on public Wi‑Fi | Keep host firewall on when not on corporate VPN | [ ] |

---

## 14-day patch SLA

**Policy:** Any vendor fix for a vulnerability that is **critical**, **high**, or CVSS v3 ≥ **7.0** must be applied to in-scope systems within **14 days** of release (Cyber Essentials auto-fail if not).

| Layer | How we meet it |
|-------|----------------|
| Azure PaaS (Postgres, Container Apps platform) | Microsoft managed updates |
| Application dependencies | Dependabot PRs (`.github/dependabot.yml`); merge and deploy within 14 days of advisory |
| Container base image | Trivy image scan fails CRITICAL/HIGH on PR and before ACR push; rebuild with `apk upgrade` / newer Node tag |
| Operator devices | OS automatic updates + monthly verification |

**Evidence to keep:** Dependabot PR dates, GitHub Actions Security Scans / Azure Deploy runs, Azure Activity Log for platform updates.

---

## Disable a user (leavers / inactive)

```sql
UPDATE users SET disabled_at = NOW() WHERE email = 'user@example.com';
```

Login rejects disabled accounts. Re-enable: `UPDATE users SET disabled_at = NULL WHERE email = '...';`

---

## Priority remaining before certification

1. Complete MFA + device checklists (Org)  
2. Fill scope locations and full SaaS list  
3. Keep firewall register and Dependabot PRs current  
4. Optional: private Postgres VNet for stronger network boundary  
