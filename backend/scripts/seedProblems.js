/*
 * npm run seed:problems [-- --dir <path>] [-- --only slug,slug] [-- --dry-run] [-- --yes]
 *
 * Writes the problem packages (backend/problems/ unless --dir says otherwise)
 * to the database in MONGODB_URI. Run it on a machine with Docker and the
 * sandbox images; see problemkit/README.md.
 *
 * For any database that isn't local it asks you to type the database's name
 * before writing, unless --yes is given.
 */
require("dotenv").config();
const path = require("path");
const readline = require("readline/promises");
const mongoose = require("mongoose");
const { execute } = require("../docker/judge");
const { seedProblems } = require("../problemkit/seed");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "mongo"]);

function parseArgs(argv) {
  const opts = { only: [], dryRun: false, yes: false, root: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") opts.dryRun = true;
    else if (argv[i] === "--yes") opts.yes = true;
    else if (argv[i] === "--only") opts.only = (argv[++i] || "").split(",").filter(Boolean);
    else if (argv[i] === "--dir") opts.root = path.resolve(argv[++i] || "");
    else throw new Error(`Unknown option ${argv[i]}`);
  }
  return opts;
}

async function confirmRemote({ host, name }) {
  if (!process.stdin.isTTY) throw new Error(`${host} is not a local database; pass --yes to write to it`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`This will write problems to ${host}/${name}. Type the database name to continue: `);
    if (answer.trim() !== name) throw new Error("Not confirmed; nothing was written");
  } finally {
    rl.close();
  }
}

(async () => {
  const { yes, ...opts } = parseArgs(process.argv.slice(2));
  if (!opts.dryRun) {
    if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const { host, name } = mongoose.connection;
    console.log(`Database: ${host}/${name}`);
    if (!LOCAL_HOSTS.has(host) && !yes) await confirmRemote({ host, name });
  }
  try {
    await seedProblems({ execute, ...opts });
  } finally {
    await mongoose.disconnect();
  }
})().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
