/**
 * Split a comma separated value into trimmed, non-empty entries: "a, b,, c" becomes
 * ["a", "b", "c"]. One parser for the comma separated env values, so a fix to the
 * parsing lands everywhere at once.
 */
export function splitCommaList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
