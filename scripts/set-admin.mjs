import "dotenv/config";
import { Pool } from "pg";

/**
 * Make an account an admin (or stop it being one). Admins get the "Beheer"
 * page: create and delete accounts, reset passwords, manage households.
 *
 *   npm run user:admin -- "Liam"            grant
 *   npm run user:admin -- "Liam" --revoke   take it away again
 *   npm run user:admin                      list the admins
 *
 * This is deliberately not possible from the app itself: an admin can't hand
 * out or lose admin rights by a stray click.
 */

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const name = args.find((a) => !a.startsWith("--"))?.trim();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (check your .env).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  if (name) {
    const { rows } = await pool.query(
      "update users set is_admin = $2 where name = $1 returning name",
      [name, !revoke],
    );
    if (rows.length === 0) throw new Error(`No account named "${name}".`);
    console.log(revoke ? `${name} is no longer an admin.` : `${name} is now an admin.`);
  }
  const { rows: admins } = await pool.query(
    "select name from users where is_admin order by name",
  );
  console.log(`Admins: ${admins.map((a) => a.name).join(", ") || "(none)"}`);
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
