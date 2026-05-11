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

  // Filter controls
  const filterBar = el("div", { className: "filter-bar" });
  let filterType = "all";
  const allRenderCards = [];   // collect per-deck render functions

  const typeFilter = el("select", { className: "filter-select", onChange(e) {
    filterType = e.target.value;
    allRenderCards.forEach(fn => fn(filterType));
  }},
    el("option", { value: "all" }, "All types"),
    el("option", { value: "standard" }, "Standard"),
    el("option", { value: "text-memory" }, "Text Memory")
  );
  filterBar.appendChild(typeFilter);
  screen.appendChild(filterBar);

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

    function renderCards(type) {
      cardList.innerHTML = "";
      const filtered = type === "all" ? deckCards : deckCards.filter(c => c.type === type);
      for (const card of filtered) {
        cardList.appendChild(renderCardRow(db, card));
      }
    }
    allRenderCards.push(renderCards);
    renderCards(filterType);

    screen.appendChild(deckSection);
  }
}

function renderCardRow(db, card) {
  const row = el("div", { className: "card-row" });
  row.appendChild(el("div", { className: "card-row-title" }, card.title || "Untitled"));
  row.appendChild(el("div", { className: "card-row-type" }, card.type === "text-memory" ? "Text" : "Standard"));
  row.appendChild(renderDueChip(card));
  row.appendChild(renderMasteryBar(card.cardStats.masteryPercent));
  row.appendChild(el("button", { className: "btn btn--ghost btn--sm", onClick: () => showEditCardModal(db, card) }, "Edit"));
  row.appendChild(el("button", { className: "btn btn--ghost btn--sm btn--danger-ghost", onClick: () => deleteCardConfirm(db, card) }, "Delete"));
  return row;
}

async function deleteCardConfirm(db, card) {
  confirmModal(`Delete "${card.title || "this card"}"? This cannot be undone.`, async () => {
    const updated = { ...card, deletedAt: now(), updatedAt: now() };
    await repo.putCard(db, updated);
    showToast("Card deleted.");
    renderLibraryScreen(db);
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
