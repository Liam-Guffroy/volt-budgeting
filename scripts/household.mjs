import "dotenv/config";
import { Pool } from "pg";

/**
 * Link accounts into a household, so they get the combined "Samen" page next
 * to their own budgets. Members see each other's monthly totals and totals per
 * category there — never individual entries. There is no screen for this; like
 * creating accounts, it's done here.
 *
 *   npm run household -- link "Thuis" "Liam" "Sabrina"   put accounts in a household
 *   npm run household -- unlink "Sabrina"                take an account out again
 *   npm run household -- list                            show households and members
 *
 * `link` creates the household if no household has that name yet, and moves an
 * account that was in another household. A household left without members is
 * removed.
 */

const [, , command, ...args] = process.argv;

function usage() {
  console.error(
    [
      "Usage:",
      '  npm run household -- link "<household>" "<account>" "<account>" [...]',
      '  npm run household -- unlink "<account>"',
      "  npm run household -- list",
    ].join("\n"),
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (check your .env).");
  process.exit(1);
}
if (!["link", "unlink", "list"].includes(command)) usage();
if (command === "link" && args.length < 3) usage();
if (command === "unlink" && args.length !== 1) usage();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

/** Households nobody belongs to any more. */
const dropEmpty = () =>
  client.query(
    "delete from households h where not exists (select 1 from users u where u.household_id = h.id)",
  );

try {
  if (command === "list") {
    const { rows } = await client.query(
      `select h.name as household, coalesce(string_agg(u.name, ', ' order by u.name), '(no members)') as members
       from households h left join users u on u.household_id = h.id
       group by h.id, h.name order by h.name`,
    );
    if (rows.length === 0) console.log("No households yet.");
    for (const r of rows) console.log(`${r.household}: ${r.members}`);
  } else if (command === "unlink") {
    const name = args[0].trim();
    await client.query("BEGIN");
    const { rows } = await client.query(
      "update users set household_id = null where name = $1 returning name",
      [name],
    );
    if (rows.length === 0) throw new Error(`No account named "${name}".`);
    await dropEmpty();
    await client.query("COMMIT");
    console.log(`${name} is no longer in a household.`);
  } else {
    const [household, ...members] = args.map((a) => a.trim());
    await client.query("BEGIN");

    const found = await client.query("select name from users where name = any($1)", [members]);
    const known = new Set(found.rows.map((r) => r.name));
    const unknown = members.filter((m) => !known.has(m));
    if (unknown.length > 0) {
      throw new Error(`No account named ${unknown.map((m) => `"${m}"`).join(", ")}.`);
    }

    const existing = await client.query("select id from households where name = $1", [household]);
    const id =
      existing.rows[0]?.id ??
      (await client.query("insert into households (name) values ($1) returning id", [household]))
        .rows[0].id;

    await client.query("update users set household_id = $1 where name = any($2)", [id, members]);
    await dropEmpty();
    await client.query("COMMIT");
    console.log(`Household "${household}": ${members.join(", ")}`);
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
