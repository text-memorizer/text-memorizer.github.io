function detectImportKind(fileName, text) {
  const name = (fileName || "").toLowerCase();
  const trimmed = (text || "").trim();

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      if (json.snapshotVersion && json.database) return "snapshot";
      if (json.cards || json.decks) return "json-card-import";
      return "unknown-json";
    } catch {
      return "unknown-json";
    }
  }

  if (name.endsWith(".csv")) return "csv-cards";
  if (name.endsWith(".tsv")) return "tsv-cards";

  if (
    text.includes("Front:") ||
    text.includes("Back:") ||
    text.includes("Text:") ||
    text.includes("# Deck:") ||
    text.includes("Deck:")
  ) {
    return "markdown-deck";
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return "plain-text-card";
  }

  return "unsupported";
}
