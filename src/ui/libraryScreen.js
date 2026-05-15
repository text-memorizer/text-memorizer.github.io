async function renderLibraryScreen(db) {
  const screen = document.getElementById("screen-library");
  screen.innerHTML = "";

  let decks = (await repo.getAllDecks(db)).filter(d => !d.deletedAt);
  let cards = (await repo.getAllCards(db)).filter(c => !c.deletedAt);

  if (cryptoIsUnlocked()) {
    decks = (await Promise.all(decks.map(decryptDeck))).filter(Boolean);
    cards = (await Promise.all(cards.map(decryptCardData))).filter(Boolean);
  }

  const header = el("div", { className: "screen-header" },
    el("h1", {}, "Library"),
    el("div", { className: "header-actions" },
      el("button", { className: "btn btn--primary", onClick: () => showNewCardModal(db) }, "+ Card"),
      el("button", { className: "btn", onClick: () => { setScreen("import"); renderImportScreen(db); } }, "Import"),
      el("button", { className: "btn", onClick: () => { setScreen("export"); renderExportScreen(db); } }, "Backup"),
      el("button", { className: "btn", onClick: () => { setScreen("help"); renderHelpScreen(db); } }, "Help"),
      el("button", { className: "btn", onClick: () => { setScreen("settings"); renderSettingsScreen(db); } }, "Settings")
    )
  );
  screen.appendChild(header);

  // Deck list
  if (decks.length === 0) {
    screen.appendChild(el("div", { className: "empty-state" },
      el("p", {}, "No decks yet."),
      el("p", {}, "Create a card or import a deck to get started.")
    ));
    return;
  }

  const dueByDeck = {};
  for (const card of cards) {
    if (!dueByDeck[card.deckId]) dueByDeck[card.deckId] = 0;
    if (isDue(card.cardStats.nextDueAt)) dueByDeck[card.deckId]++;
  }

  const filterState = { type: "all", search: "", tags: new Set() };
  const allRenderCards = [];
  const allTags = Array.from(new Set(cards.flatMap(c => c.tags || []))).sort();

  const filterBar = el("div", { className: "filter-bar" });

  let searchTimer = null;
  const searchInput = el("input", {
    className: "search-input",
    type: "search",
    placeholder: "Search cards…",
    onInput(e) {
      const value = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        filterState.search = value.trim().toLowerCase();
        allRenderCards.forEach(fn => fn());
      }, 200);
    }
  });
  filterBar.appendChild(searchInput);

  const typeFilter = el("select", { className: "filter-select", onChange(e) {
    filterState.type = e.target.value;
    allRenderCards.forEach(fn => fn());
  }},
    el("option", { value: "all" }, "All types"),
    el("option", { value: "standard" }, "Standard"),
    el("option", { value: "text-memory" }, "Text Memory"),
    el("option", { value: "cloze" }, "Cloze")
  );
  filterBar.appendChild(typeFilter);
  screen.appendChild(filterBar);

  if (allTags.length > 0) {
    const tagBar = el("div", { className: "filter-bar tag-bar" });
    for (const tag of allTags) {
      const chip = el("button", {
        className: "tag-chip",
        type: "button",
        onClick: () => {
          if (filterState.tags.has(tag)) {
            filterState.tags.delete(tag);
            chip.classList.remove("tag-chip--active");
          } else {
            filterState.tags.add(tag);
            chip.classList.add("tag-chip--active");
          }
          allRenderCards.forEach(fn => fn());
        }
      }, tag);
      tagBar.appendChild(chip);
    }
    screen.appendChild(tagBar);
  }

  for (const deck of decks) {
    const deckCards = cards.filter(c => c.deckId === deck.id);
    const dueCount = dueByDeck[deck.id] || 0;

    const deckSection = el("div", { className: "deck-section", dataset: { deckId: deck.id } });

    const deckHeader = el("div", { className: "deck-header" },
      el("div", { className: "deck-info" },
        el("h2", { className: "deck-name" }, deck.name),
        el("span", { className: "deck-count" }, `${deckCards.length} cards`),
        dueCount > 0 ? el("span", { className: "deck-due-badge" }, `${dueCount} due`) : null
      ),
      el("button", {
        className: "btn btn--primary btn--sm",
        onClick: () => startReviewSession(db, deck.id)
      }, dueCount > 0 ? `Study (${dueCount})` : "Study")
    );
    deckSection.appendChild(deckHeader);

    const cardList = el("div", { className: "card-list" });
    deckSection.appendChild(cardList);

    function renderCards() {
      cardList.innerHTML = "";
      const filtered = deckCards.filter(c => cardMatchesFilter(c, filterState));
      if (filtered.length === 0) {
        const message = deckCards.length === 0
          ? "No cards in this deck yet."
          : "No cards match the current filters.";
        cardList.appendChild(el("div", { className: "empty-filter-state" },
          el("p", {}, message)
        ));
      } else {
        for (const card of filtered) {
          cardList.appendChild(renderCardRow(db, card));
        }
      }
    }
    allRenderCards.push(renderCards);
    renderCards();

    screen.appendChild(deckSection);
  }
}

function cardMatchesFilter(card, filterState) {
  if (filterState.type !== "all" && card.type !== filterState.type) return false;

  if (filterState.tags.size > 0) {
    const cardTags = new Set(card.tags || []);
    for (const t of filterState.tags) {
      if (!cardTags.has(t)) return false;
    }
  }

  if (filterState.search) {
    const parts = [];
    if (card.title) parts.push(card.title);
    const sides = getStandardSides(card);
    if (sides.length > 0) parts.push(sides.map(s => s.markdown).join("\n"));
    if (card.textMemoryCard && card.textMemoryCard.text) parts.push(card.textMemoryCard.text);
    if (card.clozeCard && card.clozeCard.text) parts.push(card.clozeCard.text);
    if (!parts.join("\n").toLowerCase().includes(filterState.search)) return false;
  }

  return true;
}

function _libraryTypeLabel(card) {
  if (card.type === "cloze") {
    const groups = card.clozeCard && card.clozeCard.groupStats ? Object.keys(card.clozeCard.groupStats) : [];
    return `Cloze (${groups.length})`;
  }
  if (card.type === "text-memory") return "Text";
  return "Standard";
}

function renderCardRow(db, card) {
  const row = el("div", { className: "card-row" });
  const hasReverseLink = !!(card.reverseOfCardId || card.hasReverseCompanion);
  row.appendChild(el("div", { className: "card-row-title" },
    hasReverseLink ? el("span", { className: "reverse-badge", title: "Reverse companion link" }, "⇄ ") : null,
    card.title || "Untitled"
  ));
  row.appendChild(el("div", { className: "card-row-type" }, _libraryTypeLabel(card)));
  row.appendChild(renderDueChip(card));
  row.appendChild(renderMasteryBar(card.cardStats.masteryPercent));
  row.appendChild(el("button", { className: "btn btn--ghost btn--sm", onClick: () => showEditCardModal(db, card) }, "Edit"));
  row.appendChild(el("button", { className: "btn btn--ghost btn--sm btn--danger-ghost", onClick: () => deleteCardConfirm(db, card) }, "Delete"));
  return row;
}

async function deleteCardConfirm(db, card) {
  const linkedCard = await findLinkedReverseCard(db, card);

  const body = el("div", {});
  body.appendChild(el("p", {}, `Delete "${card.title || "this card"}"? This cannot be undone.`));

  let linkedCheckbox = null;
  if (linkedCard) {
    linkedCheckbox = el("input", { type: "checkbox", id: "delete-linked-reverse" });
    body.appendChild(el("label", { className: "checkbox-row" },
      linkedCheckbox,
      el("span", {}, "Also delete the linked reverse card.")
    ));
  }

  showModal({
    title: "Confirm",
    body,
    actions: [
      { label: "Cancel", action: () => {} },
      { label: "Confirm", primary: true, action: async () => {
        const ts = now();
        await repo.putCard(db, { ...card, deletedAt: ts, updatedAt: ts });
        if (linkedCard && linkedCheckbox && linkedCheckbox.checked) {
          await repo.putCard(db, { ...linkedCard, deletedAt: ts, updatedAt: ts });
        }
        showToast("Card deleted.");
        renderLibraryScreen(db);
      }}
    ]
  });
}

async function startReviewSession(db, deckId) {
  const settings = await repo.getSettings(db) || {};
  const session = await reviewController.startSession(db, deckId, {
    targetCardCount: settings.dailyReviewLimit || 20,
    maxNewCards: settings.defaultNewCardsPerSession || 5
  });

  if (!session) {
    showToast("No cards due for review!", "info");
    return;
  }

  setScreen("review");
  renderReviewScreen(db);
}

function showNewCardModal(db, deckId) {
  appState.editingCard = null;
  appState.editingDeck = deckId || null;
  setScreen("editor");
  renderEditorScreen(db, null, deckId);
}

function showEditCardModal(db, card) {
  appState.editingCard = card;
  setScreen("editor");
  renderEditorScreen(db, card, card.deckId);
}
