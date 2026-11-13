/**
 * CSV for Belgian/Dutch Excel — pure, no I/O.
 *
 * Semicolon-separated (a comma is the decimal mark here), CRLF line ends, and
 * a UTF-8 byte-order mark so Excel reads accents and the euro sign correctly.
 */

const BOM = "﻿";

/**
 * One cell. Quoted when it contains the separator, a quote or a line break.
 * Text starting with = + - or @ gets a leading apostrophe: Excel would
 * otherwise run it as a formula, which is a known way to smuggle one in
 * through a name field.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A number the way Excel here expects it: decimal comma, no grouping. */
export function csvAmount(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

/** "2026-11-13" -> "13/11/2026" */
export function csvDate(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Rows of already-formatted cells -> the file's text. Amounts and dates are not re-escaped. */
export function toCsv(header: string[], rows: string[][]): string {
  return BOM + [header, ...rows].map((r) => r.join(";")).join("\r\n") + "\r\n";
}
