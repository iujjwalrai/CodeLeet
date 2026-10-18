# CodeLeet: Open Issues

Tracked work after Phase 0 (scaling fixes) and Phase 1 (Docker). Ordered by priority within each section.

Last updated: 2026-10-18

---

## Bugs

### 1. JavaScript runs always fail: `runJavaScript.js` is empty
- **Where:** `backend/docker/runJavaScript.js` (0 bytes)
- **Effect:** the workers call `runJavaScript(payload)`, which throws `runJavaScript is not a function`. Every JavaScript run or submission ends with status `error`, and submissions stay `in_queue` (see #2).
- **Fix:** implement it like `runPython.js` (a `node:22-alpine` sandbox, stdin per test case, same Docker flags). Then switch the `it.failing` test in `backend/tests/unit/runners.test.js` to a normal `it`.

### 2. Failed jobs leave submissions stuck at `in_queue`
- **Where:** `backend/worker/submissionWorker.js`. When the worker catches an error, it publishes status `error` (line 161), but `saveVerdict` only stores statuses the model allows (`FINAL_STATUSES`, line 17).
- **Effect:** if the worker crashes mid-job (unsupported language, the empty JS runner, a Docker failure), the submission stays `in_queue` forever.
- **Fix (needs a decision):** either add an `error` / `internal_error` status to the `Submission` model and save it, or map these failures to `runtime_error`.

### 3. A malformed `problemId` returns 500 instead of 400/404
- **Where:** `backend/controllers/runConroller.js:14`, `backend/controllers/submissionController.js:15`
- **Effect:** `Problem.findById("not-an-id")` throws a `CastError`, which the error handler turns into a 500.
- **Fix:** check `mongoose.isValidObjectId(problemId)` first and return 400 (or 404).

### 4. Register form never shows "Name is required"
- **Where:** `client/src/pages/RegisterPage.jsx:76-78`
- **Effect:** the field is registered as `fullName`, but the message reads `errors.name`, so it's always undefined.
- **Fix:** change `errors.name` to `errors.fullName`.

---

## Phase 2: Load balancing and horizontal scaling

### 5. Readiness endpoint
- Add `/api/ready`, which pings MongoDB and Redis and returns 503 until both answer.
- Point the `HEALTHCHECK` in `backend/Dockerfile` (line 23) at it, so traffic only reaches replicas that can actually serve it.

### 6. Load-balance the API across replicas
- In `client/nginx.conf` (line 6), change `server api:5000;` to `server api:5000 resolve;` with a `zone` and `least_conn`, so nginx picks up `--scale api=N` without a reload.
- Have `/api/health` include the replica's container name, to prove requests are spread out.
- Verify that a job queued through one replica reaches a WebSocket connected to another (via Redis pub/sub).

### 7. Configurable worker concurrency
- Both workers create `new Worker(...)` with BullMQ's default concurrency of 1 (`submissionWorker.js:182`, `runWorker.js:19`).
- Add a `WORKER_CONCURRENCY` env var, then scale with `--scale submission-worker=N`.

### 8. Network isolation and resource limits
- Make the `core` network `internal: true` locally (production with Atlas/Upstash needs outbound access).
- Add CPU and memory limits per service in `docker-compose.yml`.

### 9. Rolling restarts
- Compose alone can't do zero-downtime deploys. Document the options: the `docker-rollout` plugin, or Docker Swarm later.

---

## Docs and cleanup

### 10. `backend/tests/flow.md` is out of date
- It still describes `wsServer.js` saving verdicts (now done by the submission worker), and lists the two 404 tests as known bugs (fixed in Phase 0).

### 11. README: add a "Run with Docker" section
```bash
cp .env.example .env            # set JWT_SECRET (openssl rand -hex 32)
mkdir -p /tmp/codeleet-jobs
docker compose --profile sandbox build
docker compose --profile sandbox pull sandbox-python
docker compose up -d            # http://localhost:8080
```

### 12. `nodemon` ships in the production image
- **Where:** `backend/package.json:13` lists it under `dependencies`.
- **Fix:** move it to `devDependencies`.

### 13. Duplicate MongoDB index definitions on `User`
- **Where:** `backend/models/User.js`. `email` and `username` are declared `unique: true` (lines 27-28) and again with `userSchema.index(...)` (lines 46-47).
- **Effect:** Mongoose prints duplicate-index warnings at startup, and MongoDB rejects the second definition (the test helper works around it).
- **Fix:** delete lines 46-47.

### 14. No `backend/.env.example`
- **Where:** `backend/.gitignore:6` ignores `.env.example`.
- **Effect:** anyone running the backend without Docker has no list of required variables.
- **Fix:** remove that ignore line and add `backend/.env.example`.

---

## Before deploying to production

### 15. The submission worker needs `MONGODB_URI`
Since Phase 0 the worker saves verdicts itself, so it connects to MongoDB. Set `MONGODB_URI` wherever it runs (e.g. Render).

### 16. Choose a host for the workers
Workers need the host's Docker socket to start sandbox containers. Render can't provide that, so the workers need a VM (Hetzner, DigitalOcean, EC2). Atlas and Upstash can stay.

---

## Notes for anyone pulling these changes

- **Run `npm ci` in `backend/` after pulling.** Phase 0 removed `backend/node_modules` from git, and pulling that change deletes the previously tracked packages from disk (`express`, `mongoose`, `bullmq`, ...). Docker and CI aren't affected, because they install their own.
- **Apple Silicon:** all images build on `arm64` and `amd64`. The Java sandbox uses `eclipse-temurin:21-jdk-alpine`, since `17-jdk-alpine` is published for `amd64` only.

---

## Recently fixed

| Issue | Fix |
|---|---|
| C++ runs always failed with `./main: Permission denied` | Docker mounts `--tmpfs` as `noexec` by default. The run step in `runCpp.js` now uses `--tmpfs /tmp:rw,exec,nosuid,size=32m`, and a regression test covers it. |
| Java sandbox image couldn't build on Apple Silicon | `Dockerfile.java` now uses `eclipse-temurin:21-jdk-alpine` (built for `arm64` and `amd64`). |
| Unknown problems returned 500 instead of 404; verdicts lost when the tab closed; the API bound to localhost only; no graceful shutdown | Phase 0 (PR #1) |

Verified end to end in Docker on 2026-10-18: C++, Python and Java runs accepted; a wrong C++ submission judged `wrong_answer` and saved with its failing test case.
