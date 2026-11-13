import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { FREQUENCIES, monthlyEquivalent } from "@/lib/budget";
import { csvAmount, csvCell, csvDate, toCsv } from "@/lib/csv";
import { todayKey } from "@/lib/month";
import { getUserId } from "@/lib/session";
import { searchEntries, toEntryKind } from "../zoeken/search";

/**
 * CSV downloads of the logged-in account's own data.
 *
 *   /export?soort=eenmalig[&q=...][&type=alle|kosten|inkomsten]   one-time entries
 *   /export?soort=vast                                             recurring costs
 *
 * The one-time export takes the same filters as the search page and uses the
 * same query, so the file matches the list it was downloaded from.
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await getUserId();
  if (userId === null) return new Response("Niet ingelogd.", { status: 401 });

  const params = new URL(request.url).searchParams;
  const today = todayKey();

  if (params.get("soort") === "vast") {
    const rows = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(asc(expenses.position), asc(expenses.id));

    return csvResponse(
      `vlot-vaste-kosten-${today}.csv`,
      toCsv(
        ["Naam", "Bedrag", "Frequentie", "Per maand"],
        rows.map((r) => [
          csvCell(r.name),
          csvAmount(Number(r.amount)),
          csvCell(FREQUENCIES[r.frequency].label),
          csvAmount(monthlyEquivalent({ amount: Number(r.amount), frequency: r.frequency })),
        ]),
      ),
    );
  }

  const found = await searchEntries(
    userId,
    (params.get("q") ?? "").slice(0, 120),
    toEntryKind(params.get("type")),
  );

  return csvResponse(
    `vlot-eenmalig-${today}.csv`,
    toCsv(
      ["Datum", "Soort", "Naam", "Bedrag"],
      found.map((e) => [
        csvDate(e.date),
        e.kind === "kosten" ? "Kost" : "Inkomen",
        csvCell(e.name),
        csvAmount(e.amount),
      ]),
    ),
  );
}

function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Personal data: never let a shared cache keep it.
      "Cache-Control": "no-store",
    },
  });
}
