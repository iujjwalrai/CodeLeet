# Deploying CodeLeet

Production runs `docker-compose.yml` + `docker-compose.prod.yml` on one
Linux server: Caddy (HTTPS), the gateway, the API, the workers and Redis.
MongoDB is on Atlas. Images are built by CI and published to GHCR; nothing
is built on the server.

## How a deploy happens

1. A push to `main` runs CI. When the tests pass, `publish.yml` pushes every
   image tagged `latest` and with the 7-character commit SHA.
2. `deploy.yml` then waits in the **production** environment until you
   approve it on the run's page in GitHub (Review deployments → Approve).
3. It copies the compose files, `Caddyfile` and `deploy.sh` from that commit
   to the server over SSH, and runs `deploy/deploy.sh <sha>`, which pins
   `TAG=<sha>` in the server's `.env`, pulls the images, restarts what
   changed, waits for `/api/ready` and removes old images.

**Roll back or redeploy:** Actions → Deploy → Run workflow, with the commit
SHA to deploy. Any commit whose images were published works.

## One-off setup

### 1. Cloud firewall

In the cloud console (Oracle: Networking → Virtual cloud network → Security
list), allow inbound TCP 80 and 443 and UDP 443 from `0.0.0.0/0`. SSH (22)
must stay reachable from GitHub's runners, so use key-only login (the
default on Oracle's images).

### 2. Server

From the repo, copy the setup script to the server and run it (Ubuntu):

```sh
scp deploy/setup-server.sh ubuntu@<server-ip>:
ssh ubuntu@<server-ip> 'sudo bash setup-server.sh ubuntu'
```

It installs Docker, adds 2 GB of swap if there is none, opens ports 80/443
in the server's own iptables (Oracle's images block them even when the
security list allows them), and creates `/var/lib/codeleet/jobs` and
`~/codeleet`. Log out and back in afterwards, so the docker group applies.

### 3. Settings

On the server, create `~/codeleet/.env` from `.env.prod.example` in this repo
and fill in every value, including the `DOCKER_GID` the script printed.

On a **1 GB server**, until it has its own small-host settings, run one of
each judging worker and no analysis worker:

```sh
SUBMISSION_WORKER_REPLICAS=1
RUN_WORKER_REPLICAS=1
ANALYSIS_WORKER_REPLICAS=0
```

### 4. DNS and MongoDB Atlas

- Point the domain's A record (`DOMAIN` in `.env`) at the server's IP. Caddy
  gets the HTTPS certificate on first start.
- In Atlas → Network Access, allow the server's IP.

### 5. Public images

The server pulls images without logging in, so make each package public:
GitHub → your profile → Packages → `codeleet-api`, `codeleet-worker`,
`codeleet-gateway`, `codeleet-cpp`, `codeleet-java` → Package settings →
Change visibility → Public. They hold no secrets or problem data.

### 6. Deploy key

On your machine, make a key used only for deploys and allow it on the server:

```sh
ssh-keygen -t ed25519 -f codeleet-deploy -N "" -C "github-deploy"
ssh-copy-id -i codeleet-deploy.pub ubuntu@<server-ip>
ssh-keyscan <server-ip> > known_hosts.txt
```

Check that the ed25519 fingerprint `ssh-keygen -lf known_hosts.txt` prints
matches the server's own (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
on the server), so the workflow trusts the right machine.

### 7. GitHub environment

Repo → Settings → Environments → New environment `production`:

- **Required reviewers:** yourself. Every deploy then waits for your approval.
- **Deployment branches:** `main` only.
- **Environment secrets:**

  | Secret | Value |
  |---|---|
  | `DEPLOY_HOST` | the server's IP or hostname |
  | `DEPLOY_USER` | `ubuntu` (or the user you set up) |
  | `DEPLOY_SSH_KEY` | the contents of `codeleet-deploy` (the private key) |
  | `DEPLOY_KNOWN_HOSTS` | the contents of `known_hosts.txt` |

- Optional **variable** `DEPLOY_PATH` if the app folder isn't `~/codeleet`.

Then delete the private key from your machine or keep it somewhere safe.

### 8. First deploy

Actions → Deploy → Run workflow with the latest `main` commit SHA, then
approve it. Afterwards seed the problems from your machine as described in
`backend/problemkit/README.md`.

## On the server

```sh
cd ~/codeleet
docker compose ps                 # COMPOSE_FILE in .env picks the files
docker compose logs -f api        # or worker, gateway, caddy
docker compose exec -T redis redis-cli info memory
```
