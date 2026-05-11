function parsePlainTextCard(text, fileName) {
  const title = truncate(text.trim(), 8) || (fileName || "Imported Text");
  return {
    deck: "Imported Texts",
    cards: [{
      type: "text-memory",
      title,
      deck: "Imported Texts",
      tags: [],
      text: text
    }]
  };
}
