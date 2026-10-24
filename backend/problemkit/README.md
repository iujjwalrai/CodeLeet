# Problem packages

Every problem is a folder named after its slug, in `backend/problems/` by
default. Packages hold hidden tests and reference solutions, so that folder
is in `.gitignore` and `.dockerignore`. It lives only on the machine you seed
from, so back it up yourself.

`npm run seed:problems` checks every package, judges it in the sandbox and
only then writes them all to the database. Problems are matched by slug, so
their ids and stats are kept. It needs Docker and the sandbox images
(`docker compose --profile sandbox build`).

```sh
# Local stack: the worker container can reach the local database; the
# packages are mounted for this one run, never built into an image
docker compose run --rm -v "$PWD/backend/problems:/app/problems:ro" \
  submission-worker npm run seed:problems

# Production: from backend/ on your machine, pointing at the production database.
# It shows the host and asks you to type the database name before writing.
MONGODB_URI='<production uri>' npm run seed:problems

# Check without writing, only some packages, or packages kept elsewhere
npm run seed:problems -- --dry-run --only maximum-subarray,sum-check
npm run seed:problems -- --dir ~/codeleet-problems
```

`--yes` skips the confirmation, for scripts.

## Files

| File | |
|---|---|
| `problem.json` | Statement, signature, examples and optional `timeLimitMs` |
| `tests.json` | Hand-written and generated tests |
| `reference.cpp` | A correct `class Solution`, written as a user would |
| `reference.java` | Optional. Judged too when present |
| `generator.cpp` | Prints one input for a size `n` and a `seed` |
| `complexity.json` | Optional. Sizes to time after Accepted, and the expected complexity |
| `cpp/driver.cpp`, `cpp/starter.cpp`, `java/Main.java`, `java/Starter.java` | Optional hand-written replacements for the generated code |

### problem.json

```json
{
  "title": "Maximum Subarray",
  "difficulty": "Medium",
  "topics": ["Array", "Dynamic Programming"],
  "description": "Plain text. A blank line starts a new paragraph.",
  "constraints": ["1 <= nums.length <= 10^5"],
  "timeLimitMs": 500,
  "function": { "name": "maxSubArray", "params": [{ "name": "nums", "type": "int[]" }], "returns": "int" },
  "examples": [{ "args": [[-2, 1, -3, 4]], "output": 4, "explanation": "Optional." }]
}
```

- Topics must come from `problemkit/topics.json`.
- Write statements in your own words.
- Every test must have exactly one correct output. Where several answers would
  be right, restate the task, for example "return the indices in increasing
  order" or "return the count".
- `timeLimitMs` applies to each test and defaults to 1000. The seed refuses a
  limit below 5x the slowest reference run. Set it low enough that the slow
  approach you want to rule out gets Time Limit Exceeded on the biggest
  tests.

### Types

`int`, `long`, `bool`, `string`, `int[]`, `long[]`, `string[]`, `int[][]`,
`char[][]`, `List<int>`, `List<string>`, `List<List<int>>`, `ListNode`,
`TreeNode`.

Tests write each argument as one JSON value per line, and the output as one
JSON value:

- `char[][]` is a list of row strings: `["110","011"]`.
- `ListNode` is the list of its values in order.
- `TreeNode` is level order with `null` for a missing child, without
  trailing nulls: `[3,9,20,null,null,15,7]`.
- Strings are printable ASCII.

The `List` types use the same JSON as the arrays. In Java they are
`List<...>`, which suits ragged results like a level-order traversal.

### tests.json

```json
{ "tests": [
  { "args": [[-3, -1, -2]], "output": -1 },
  { "gen": [100000, 6] }
] }
```

- Examples are judged automatically as the first, visible tests.
- Everything in `tests.json` is hidden unless it says `"hidden": false`.
- Hand-written tests carry their output, and the reference must agree with it.
- Generated tests take their input from the generator and their output from
  the reference.
- All test data together must stay under 2 MB, since it is copied into every
  judging job.

### generator.cpp

```cpp
void generate(long long n, Rng& rng) {
    vector<int> nums(n);
    for (auto& x : nums) x = rng.range(-10000, 10000);
    emitInts(nums);
}
```

`runtime/gen.hpp` provides:

- `Rng`: `range`, `chance`, `shuffle`, `pick`.
- `emitInt`, `emitBool`, `emitString`, `emitInts`, `emitStrings`,
  `emitIntGrid`, `emitTree`.
- `levelOrder`, to turn child links into tree input.

Call one `emit` per parameter, in order. All randomness must come from `rng`;
the seed runs every generator twice and fails if the output differs. Using
`seed % k` to pick between input shapes (all negative, a long chain and so
on) keeps the tests varied.

## Smaller failing inputs (Phase 3)

Seeding also stores private `analysisTools`: the signature, generator, C++
reference, and each generated test's `(index, n, seed)`. Like hidden tests,
this field is `select: false`. Problem API responses and WebSocket messages
never include trusted source. Existing database records need a validated
re-seed to enable analysis; legacy records continue judging normally.

After C++/Java Wrong Answer, Runtime Error, TLE or MLE, Run and Submit may
search for a smaller reproducer. The verdict is sent first with
`analysisPending: true`; a separate `{type: "ANALYSIS", status: ...}` event
follows on the same channel. Submit saves the public search result at
`analysis.counterexample`. Replay retains both the verdict and analysis.

The search considers smaller known cases and regenerated inputs, preserving
the failing generated test's seed. Its conservative floor is the smallest
authored generator size; its step is the GCD of authored size differences
(or 1 for a single size). Authors must generate valid problem inputs on that
lattice within the authored range. This preserves odd-only generators
without interpreting prose constraints. Sizes below the authored floor are
deliberately not tried. No package format changes are required.

This is a bounded search, not proof of a globally minimum counterexample or
a monotone binary search. It tries at most eight candidates, caps small
inputs/expected outputs at 4 KB, and budgets eight seconds of user execution
across two independent runs per candidate. Problems with time limits above
four seconds are skipped. Compilation (15 seconds per sandbox), generation
(500 ms per candidate), reference runs, and Docker startup have separate
limits, so total analysis time can be longer. Generator, reference, and user
are compiled once each in separate sequential sandboxes; trusted source is
never mounted into the untrusted user's container. A reported input must
reproduce the original failure category twice under the original limits.

Analysis finishes as `found`, `not_found`, `skipped`, or `error`; none changes
the verdict. Accepted and compilation errors do not trigger it. The frontend
keeps the stream open while analysis is pending and displays its result
separately. Complexity fitting / a low-priority queue remains Phase 4.

## Time complexity (Phase 4)

After an Accepted C++ or Java submission, problems with a `complexity.json`
queue a job on `analysis-queue`. The `analysis-worker` service (one job at a
time) generates inputs at growing sizes, times the solution, fits a
complexity class and saves it at `analysis.complexity`. The verdict says
`complexityPending: true`, and a `{type: "COMPLEXITY", ...}` event follows on
the submission's channel. Judging never waits for it.

```json
{ "sizes": [6250, 12500, 25000, 50000, 100000], "seeds": [6], "expected": "n" }
```

| Key | |
|---|---|
| `sizes` | 4 to 8 increasing generator sizes, at most the largest generated test |
| `seeds` | 1 or 2 seeds; each size is timed on each and the slowest counts |
| `expected` | `1`, `log n`, `n`, `n log n`, `n^2`, `n^3` or `2^n` |
| `measure` | `n` (default) or `n^2`: the problem size for a generator size, e.g. `n^2` cells for an n x n grid |
| `variable` | How the size is written, default `n`, e.g. `m·n` |
| `repeat` | Default 1. Calls per timing, for functions too fast to time once (binary search). Only for functions that don't change their input |

Timing covers only the call to the solution, not reading input or starting
the JVM. Each run takes many samples on fresh copies of the input and keeps
the fastest, which also lets Java's JIT warm up; each input runs 3 times.
The fit is `time = a·f(N) + b` for each class, by relative error. Of the
classes within 25% of the best error, the slowest-growing is reported, since
the constant term lets faster-growing classes fit flat timings too. `n` and
`n log n`, and `1` and `log n`, are never reported as faster or slower than
each other ("hard to tell apart"): cache misses make linear hashing look like
`n log n` at these sizes. Results are inconclusive when fewer than 4 sizes
finish, the largest takes under 0.01 ms, or the error is high. Inputs with
lists or trees take at most 20 samples per run, since C++ never frees the
nodes it reads.

The seed times the C++ reference the same way and fails unless it fits
`expected` (or is too close to call with it), so check a profile with
`--dry-run --only <slug>`. Choose a seed whose input has the same shape at
every size: a shape picked at random per size (a random density, a random
target position) changes the work per element and bends the curve. Choose
the worst case for the solutions you want to tell apart. Keep the largest
sizes below a cache cliff (a jump in time per element), and give problems
whose work depends on a random position (two-sum's pair) no profile.
