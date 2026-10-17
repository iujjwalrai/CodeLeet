# Test Flow

How the CodeLeet test suites are wired together and what happens when you run them.

| | Backend | Client |
|---|---|---|
| Runner | Jest 29 | Vitest 3 |
| Location | `backend/tests/` | `client/src/**/*.test.jsx`, helpers in `client/src/test/` |
| Command | `cd backend && npm test` | `cd client && npm test` |
| Coverage | `npm run test:coverage` | `npm run test:coverage` |
| External services needed | None (MongoDB runs in memory) | None |

---

## Backend

### 1. What happens on `npm test`

```mermaid
flowchart TD
    A[npm test → jest] --> B[globalSetup.js<br/>start one in-memory MongoDB<br/>export MONGO_TEST_URI]
    B --> C{for each *.test.js<br/>in parallel workers}
    C --> D[setup/env.js<br/>set JWT_SECRET, GOOGLE_*, REDIS_URL…]
    D --> E[setup/silenceConsole.js<br/>mute console unless DEBUG_TESTS=1]
    E --> F[moduleNameMapper<br/>swap real Redis / queues / connectDB<br/>for tests/mocks/*]
    F --> G[helpers/db.js useTestDb<br/>beforeAll: connect to a fresh, uniquely named DB<br/>afterEach: empty all collections<br/>afterAll: drop DB + disconnect]
    G --> H[run the tests]
    H --> C
    C -->|all files done| I[globalTeardown.js<br/>stop MongoDB]
```

### 2. Real vs fake

| Dependency | In tests | Where |
|---|---|---|
| MongoDB | **Real** MongoDB in memory (mongodb-memory-server) | `setup/globalSetup.js`, `helpers/db.js` |
| `config/db.js` (`connectDB`) | No-op; tests connect themselves | `mocks/db.js` |
| `config/redis.js` (cache) | `get` / `set` / `publish` as `jest.fn` | `mocks/redis.js` |
| `config/redispubsub.js` | `EventEmitter` with `subscribe` / `unsubscribe` as `jest.fn` | `mocks/redispubsub.js` |
| `queue/runQueue.js`, `queue/submissionQueue.js` | `add` as `jest.fn` returning `{ id }` | `mocks/queue.js` |
| `docker run` (via `child_process.exec`) | `jest.mock('child_process')` with a fake that answers per command | `unit/runners.test.js` |
| Express app + WebSocket server | **Real** | `app.js`, `wsServer.js` |

Mocks are wired globally in `jest.config.js` → `moduleNameMapper`, so any `require('../config/redis')` anywhere in the app gets the fake. `clearMocks: true` resets call history between tests.

### 3. Folder layout

```
backend/tests/
├── setup/          runs around every test file (env, console, Mongo lifecycle)
├── mocks/          stand-ins for Redis, BullMQ queues, connectDB
├── helpers/        db.js (useTestDb) and factories.js (createUser, createProblem, createSubmission, authFor)
├── unit/           pure logic: token, username, User model, code runners
├── api/            HTTP routes through supertest(app)
└── integration/    real WebSocket client ↔ wsServer ↔ fake Redis pub/sub
```

### 4. Flow of a typical API test

```mermaid
sequenceDiagram
    participant T as Test
    participant F as factories.js
    participant DB as In-memory MongoDB
    participant A as Express app (supertest)
    participant Q as mocks/queue.js

    T->>F: createUser(), createProblem()
    F->>DB: insert documents
    T->>F: authFor(user)
    F-->>T: { bearer, cookie } (real JWT)
    T->>A: POST /api/submissions + Authorization
    A->>DB: protect middleware loads user
    A->>DB: create Submission (in_queue), bump stats
    A->>Q: add('run-submission', payload)
    A-->>T: 201 { jobId }
    T->>DB: assert saved documents
    T->>Q: assert queue.add called with right payload
    Note over T,DB: afterEach → collections emptied
```

### 5. Flow of the code-runner tests

```mermaid
flowchart LR
    T[runners.test.js] -->|fakeDocker handler| X[mocked exec]
    T -->|process.cwd → temp dir| R[runCpp / runJava / runPython]
    R -->|compile cmd| X
    R -->|run cmd + stdin per test case| X
    X -->|stdout / stderr / error| R
    R -->|verdict| T
    T -->|assert| V[status, passedCount, failedTestCase,<br/>sandbox flags in every cmd,<br/>temp dir cleaned up]
```

The fake decides the response from the command text (compile vs run) and the stdin (the test-case input), so the same runner code that runs in production is exercised end to end, minus Docker.

### 6. Flow of the WebSocket tests

```mermaid
sequenceDiagram
    participant C as ws client (test)
    participant S as wsServer (real, random port)
    participant P as mocks/redispubsub (EventEmitter)
    participant DB as In-memory MongoDB

    C->>S: { type: "RUN", jobId: "7" }
    S->>P: subscribe("job-updates:7")
    Note over C,P: test plays the worker
    P-->>S: emit("message", channel, payload)
    S-->>C: forward payload
    C->>S: close
    S->>P: unsubscribe("job-updates:7")

    Note over P,DB: SUBMIT with a final status
    P-->>S: emit("message", …status: "wrong_answer")
    S->>DB: Submission.updateOne(verdict)
```

---

## Client

### 1. What happens on `npm test`

```mermaid
flowchart TD
    A[npm test → vitest run] --> B[vitest.config.js<br/>merges vite.config.js<br/>env: jsdom, VITE_API_BASE_URL=http://api.test]
    B --> C[src/test/setup.js<br/>jest-dom matchers<br/>afterEach: cleanup DOM + clear localStorage]
    C --> D[each *.test.jsx<br/>vi.mock axios / useAuth / react-hot-toast]
    D --> E[renderWithRouter<br/>MemoryRouter + catch-all LocationProbe]
    E --> F[user-event clicks / typing]
    F --> G[assert DOM, mock calls,<br/>and current path via data-testid=location]
```

### 2. Real vs fake

| Dependency | In tests |
|---|---|
| `src/api/axios.js` | `vi.mock` with `get` / `post` as `vi.fn` |
| `useAuth` from `AuthContext` | `vi.mock` returning `{ user, loading, setUser }` per test (except `AuthContext.test.jsx`, which tests the real provider) |
| `react-hot-toast` | `vi.mock` with `success` / `error` as `vi.fn` |
| React Router | **Real**, via `MemoryRouter` |
| Components, forms, framer-motion | **Real** |

### 3. How navigation is asserted

`renderWithRouter(ui, { route })` mounts the component at `route` plus a catch-all route rendering `<LocationProbe />`. When the component navigates away, the probe shows the new path:

```js
expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
```

---

## Known-bug tests (`it.failing`)

These tests describe the *correct* behaviour and are expected to fail today. Jest reports them as passing while the bug exists. Once the bug is fixed they start failing, as a reminder to change `it.failing` to `it`.

| Test | Bug |
|---|---|
| `api/submissions.test.js` → returns 404 for an unknown problem (submit) | `submissionController.js` reads `problem.codeTemplates` before the null check → 500 |
| `api/submissions.test.js` → returns 404 for an unknown problem (run) | Same in `runConroller.js` |
| `unit/runners.test.js` → runJavaScript exports a runner function | `docker/runJavaScript.js` is empty, so all JavaScript runs fail |

---

## Adding a new test

**Backend API route**
1. Create `backend/tests/api/<thing>.test.js`.
2. Call `useTestDb()` at the top.
3. Build data with `createUser` / `createProblem` / `createSubmission`; authenticate with `authFor(user).bearer`.
4. `await request(app).get(...).set('Authorization', bearer)` and assert on the response and the DB.

**Client component**
1. Create `<Component>.test.jsx` next to the component.
2. `vi.mock` axios / `useAuth` as needed.
3. Render with `renderWithRouter` if it uses the router; otherwise `render`.
4. Drive it with `userEvent`, assert with jest-dom matchers.

## CI notes

- Both suites: `npm ci && npm test`.
- First backend run downloads a MongoDB binary (~100 MB). Cache `~/.cache/mongodb-binaries`.
- `DEBUG_TESTS=1 npm test` in `backend/` shows app logs when debugging a failure.
