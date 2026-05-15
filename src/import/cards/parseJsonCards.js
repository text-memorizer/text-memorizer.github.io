function parseJsonCards(text) {
  const json = JSON.parse(text);

  const decks = (json.decks || []).map(d => ({
    name: d.name || "Imported Deck",
    tags: d.tags || []
  }));

  const cards = (json.cards || []).map(c => {
    const type = (c.type || "standard").toLowerCase().replace(/_/g, "-");
    const base = {
      type,
      title: c.title || "",
      deck: c.deck || (decks[0] && decks[0].name) || "Imported Deck",
      tags: c.tags || []
    };
    if (type === "text-memory") {
      base.text = c.text || "";
    } else {
      if (Array.isArray(c.sides) && c.sides.length > 0) {
        base.sides = c.sides.map(s => ({
          markdown: typeof s === "string" ? s : ((s && (s.markdown || s.text)) || "")
        }));
      } else {
        base.sides = [
          { markdown: c.frontMarkdown || c.front || "" },
          { markdown: c.backMarkdown || c.back || "" }
        ];
      }
    }
    return base;
  });

  return { decks, cards };
}
