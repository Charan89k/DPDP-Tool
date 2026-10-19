# Production checklist

Moving from a laptop trial (Cloudflare quick tunnel, Mailpit) to a production server needs no code
changes, only hosting and configuration. Step-by-step commands are in [SELF_HOSTING.md](SELF_HOSTING.md).

| # | Change | How | Why |
|---|---|---|---|
| 1 | Linux server | Docker Engine and the Compose plugin; 2 GB RAM, 4 GB with ClamAV. Choose a region that meets your customers' data-residency expectations | Always on, fixed address |
| 2 | Domain | Point e.g. `cloude5.example.com` (A/AAAA record) at the server | Permanent address and HTTPS |
| 3 | HTTPS proxy instead of the tunnel | `CLOUDE5_DOMAIN=cloude5.example.com docker compose --profile proxy --profile antivirus up -d`; do not start the `tunnel` or `mail` profiles | Automatic certificates |
| 4 | `.env` on the server | `CLOUDE5_PUBLIC_URL=https://cloude5.example.com`; real `SMTP_*` values; `TRUST_CLOUDFLARE_IP_HEADER=false` unless Cloudflare proxies the domain; `CLOUDE5_CLAMAV_HOST=clamav` | Correct email links and client IPs |
| 5 | Secrets | Fresh start: new `SESSION_SECRET` (`openssl rand -base64 48`) and `CLOUDE5_ENCRYPTION_KEY` (`openssl rand -base64 32`). Moving existing data: copy the existing `CLOUDE5_ENCRYPTION_KEY`, otherwise two-factor enrolments become unreadable | Sessions and MFA secrets |
| 6 | Email sender | Send from your own domain (e.g. `no-reply@example.com`) and publish the SPF, DKIM and DMARC records your SMTP provider gives you | Mail is delivered, not filtered as spam |
| 7 | Data | Fresh start: `migrate` then `admin:create`. Moving data: `backup-all` on the old machine, copy the files, then [restore](SELF_HOSTING.md#restore) on the server | Start clean or keep customers |
| 8 | Off-server backups | Nightly `backup-all` from cron, copied encrypted to separate storage; test a restore | Survive losing the server |
| 9 | Server hardening | Firewall allowing only 22, 80 and 443; SSH keys only; automatic security updates | Reduce attack surface |
| 10 | Monitoring | External uptime check on `https://cloude5.example.com/api/ready` | Know when it is down |
| 11 | Releases | Deploy from `main`: `git pull && docker compose build && docker compose up -d`. A backup is written automatically before each schema upgrade | Repeatable upgrades |

After the switch:

- [ ] `curl -fsS https://cloude5.example.com/api/ready` reports `ready`, including `virus_scanner`
- [ ] Register a test organisation and receive the verification email in a real inbox
- [ ] Sign in as the platform administrator, turn on two-factor, and delete
      `/data/cloude5-admin-credentials.txt`
- [ ] Run the browser tests against the server: `E2E_BASE_URL=https://cloude5.example.com npm run test:e2e`
      (needs Mailpit, so run them against a staging copy if production uses a real SMTP provider)
