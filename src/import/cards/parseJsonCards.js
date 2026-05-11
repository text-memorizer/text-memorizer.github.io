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
      base.frontMarkdown = c.frontMarkdown || c.front || "";
      base.backMarkdown = c.backMarkdown || c.back || "";
    }
    return base;
  });

  return { decks, cards };
}
