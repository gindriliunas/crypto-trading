# Firewall / inbound access register

Cyber Essentials requires inbound firewall rules to be **approved**, **documented**, and limited to a clear **business need**.

Last reviewed: 2026-09-16  
Approver: platform owner (update name before CE submission)

| Rule ID | System | Direction | Source | Destination / port | Action | Business need | Approved by | Review date |
|---------|--------|-----------|--------|-------------------|--------|---------------|-------------|-------------|
| ACA-01 | Azure Container Apps `*-app` | Inbound | Internet (any) | HTTPS 443 → app port 3000 | Allow | Public paper-trading dashboard (`dev.gindri.com`) | Platform owner | 2026-09-16 |
| PG-01 | Postgres Flexible Server | Inbound | Azure services (`0.0.0.0` sentinel) | TCP 5432 | Allow | Container Apps must reach Flexible Server without VNet integration | Platform owner | 2026-09-16 |
| PG-02+ | Postgres Flexible Server | Inbound | CIDRs in `db_admin_cidrs` (tfvars) | TCP 5432 | Allow | Break-glass / admin SQL from named operator IPs only | Platform owner | when CIDRs set |

## Notes

- **PG-01** uses Azure’s documented `0.0.0.0–0.0.0.0` firewall entry meaning “Allow Azure services,” not the entire internet. Prefer private VNet + private DNS when networking maturity allows; until then keep this register current.
- Do **not** add `0.0.0.0–255.255.255.255` (open to the world).
- Remove CIDR rules when the operator IP or business need ends.
- Container Apps ingress is HTTPS-terminated by Azure; only the app’s HTTP target port is internal to the platform.

## Change process

1. Propose rule (source, port, need).  
2. Record in this table and set `db_admin_cidrs` in `azure/envs/<env>.tfvars` if Postgres-related.  
3. `terraform apply`.  
4. Update **Review date**.
