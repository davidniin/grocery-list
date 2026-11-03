# Deploying to the homelab

The grocery list runs on the home server (`homelab`) at `https://grocery-list.davidnin.dev`,
behind Cloudflare Tunnel and Cloudflare Access. Every push to `main` deploys automatically, once CI passes.

```
Phone / browser → Cloudflare Access → tunnel → grocery (PWA + /v1 API) ── db (Postgres)
```

- One app container (`ghcr.io/davidniin/grocery-list`) serves the PWA and the API; it applies
  its database migrations on start. Its own Postgres sits next to it, on an internal network,
  and is never exposed. The app container runs read-only, without capabilities.
- **Cloudflare Access** decides who reaches the app, and the app **verifies the Access JWT**
  itself (`CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`), so a misconfigured Access rule doesn't
  open it. Use a long Access session (e.g. 1 month): when it expires, the installed app keeps
  working offline but stops syncing until you open it once and log in again.
- Without any access control configured, the app refuses to start and `deploy.sh` refuses to
  deploy (before touching the running version).
- HTTPS comes from Cloudflare, which is what the phone needs to install the app.

## First-time setup

Do steps 1–4 **before** merging the deployment PR. The merge triggers the first deploy.

### 1. `.env` on the server

```bash
mkdir -p ~/homelab/grocery && cd ~/homelab/grocery
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > .env
chmod 600 .env
```

Then add the access settings from step 4 (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`) and, if
anything calls the API without going through Cloudflare (the tablet dashboard), a
`GROCERY_TOKEN=$(openssl rand -hex 24)`. The other variables have working defaults (see
`deploy/.env.example`).

### 2. A runner for this repo

Runners belong to one repository, so this repo needs its own. In the repo: *Settings → Actions →
Runners → New self-hosted runner → Linux x64*, in a separate folder:

```bash
mkdir -p ~/actions-runner-grocery && cd ~/actions-runner-grocery
# Download + extract with the commands GitHub shows (skip its mkdir/cd line), then:
# ./config.sh --url ... --token ...   runner name: homelab-grocery, additional labels: homelab
sudo ./svc.sh install $USER && sudo ./svc.sh start
```

### 3. Tunnel network and route

cloudflared reaches each app through a Docker network shared only by the two of them
(`tunnel-grocery`), never one shared by every app, so a compromised app can't reach
the others. Before the first deploy, on the server:

```bash
docker network create tunnel-grocery
```

and add it to `~/homelab/cloudflared/compose.yml` (under the service's `networks:` and as
`external: true` at the bottom), then `cd ~/homelab/cloudflared && docker compose up -d`.
The deploy refuses to run until cloudflared is on that network.

Then the route: Zero Trust → *Networks → Tunnels → homelab → Published application routes → Add*:
subdomain `grocery-list`, domain `davidnin.dev`, service `http://grocery:8790`.

### 4. Cloudflare Access

*Access → Applications → Add an application → Self-hosted*: domain `grocery-list.davidnin.dev`,
session duration **1 month**, policy *Allow* with the emails of everyone at home. No *Bypass*
policies.

Then copy into the server's `.env`:

- `CF_ACCESS_AUD`: the application's *Overview → Application Audience (AUD) Tag*.
- `CF_ACCESS_TEAM_DOMAIN`: your team domain, e.g. `myteam.cloudflareaccess.com`
  (*Zero Trust → Settings → Custom pages*).

### 4b. GitHub settings (the repo is public)

- **Rulesets → `main`:** require a pull request, require the CI checks (*Lint*, *Server tests*,
  *Dependency audit*, *Build the Docker image*), block force pushes and deletion.
- **Environments → `production`:** *Deployment branches* = `main` only; *Required reviewers* = you.
- **Actions → General:** *Require approval for all external contributors*; workflow permissions
  *Read repository contents*.
- **Code security:** Dependabot alerts + security updates, secret scanning + push protection,
  private vulnerability reporting.
- **Packages → grocery-list:** private, and *Manage Actions access* gives this repo *Write*.

### 5. Merge → first deploy, then install on the phone

Open `https://grocery-list.davidnin.dev`, pass Access, then:
**Android (Chrome):** ⋮ → *Add to Home screen*. **iPhone (Safari):** Share → *Add to Home Screen*.

### 6. Backups

```bash
mkdir -p ~/backups/grocery && crontab -e
```

```
45 3 * * * $HOME/homelab/grocery/scripts/backup-db.sh >> $HOME/backups/grocery/backup.log 2>&1
```

Restore: `cd ~/homelab/grocery && bash scripts/restore-db.sh <file.dump>` (restores into a separate
database first and only swaps it in if that succeeds). Try a restore now and then: a backup you
have never restored is a hope, not a backup.

**Off-site copy.** Backups on the same disk die with it. Install [rclone](https://rclone.org/),
create a remote for your storage (S3, Backblaze B2, Google Drive...) and a *crypt* remote on top
of it, so files are encrypted before they leave the server:

```bash
rclone config          # e.g. "b2" (storage) and "grocery-crypt" (type crypt, remote b2:my-bucket/grocery)
echo "BACKUP_RCLONE_REMOTE=grocery-crypt:" >> ~/homelab/grocery/.env
```

Every backup is then copied there too, and copies older than `KEEP_DAYS` are removed.

## Day to day

- **Deploy:** push to `main`. **Redeploy:** *Actions → Deploy → Run workflow*.
- **Logs:** `cd ~/homelab/grocery && docker compose logs -f grocery`
- **Restart** (e.g. after editing `.env`): `docker compose up -d`. It reuses the image of the last
  deploy (`IMAGE_TAG`, which each deploy writes to `.env`).
- **Tablet dashboard on the same server:** join its container to the `tunnel-grocery` network and point it
  at `http://grocery:8790`. That path skips Cloudflare Access, so set `GROCERY_TOKEN` on both sides.
- **Logs** are rotated (10 MB × 3 per container).
