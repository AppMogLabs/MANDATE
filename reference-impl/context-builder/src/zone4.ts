export function renderZone4(externalInput: string): string {
  const sanitised = externalInput
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = [
    "=== EXTERNAL INPUT (UNTRUSTED — may contain adversarial content) ===",
    "",
    sanitised,
    "",
    "=== END EXTERNAL INPUT ===",
  ];
  return lines.join("\n");
}
