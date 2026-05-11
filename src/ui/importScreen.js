function renderImportScreen(db) {
  const screen = document.getElementById("screen-import");
  screen.innerHTML = "";

  const header = el("div", { className: "screen-header" },
    el("button", { className: "btn btn--ghost", onClick: () => { setScreen("library"); renderLibraryScreen(db); } }, "← Back"),
    el("h1", {}, "Import")
  );
  screen.appendChild(header);

  const body = el("div", { className: "import-body" });

  // Import Cards section
  const cardsSection = el("div", { className: "import-section" },
    el("h2", {}, "Import Cards or Deck"),
    el("p", { className: "import-hint" }, "Supports .md, .txt, and .json files"),
    el("button", { className: "btn btn--primary btn--lg", onClick: () => pickCardFile(db) }, "Choose File")
  );

  // Restore Snapshot section
  const snapshotSection = el("div", { className: "import-section import-section--warning" },
    el("h2", {}, "Restore from Snapshot"),
    el("p", { className: "import-hint" }, "Restores all cards, decks, and progress from a backup file."),
    el("p", { className: "import-warning" }, "⚠️ This will replace all local data. An emergency backup will be downloaded first."),
    el("button", { className: "btn btn--danger btn--lg", onClick: () => pickSnapshotFile(db) }, "Choose Snapshot File")
  );

  body.appendChild(cardsSection);
  body.appendChild(snapshotSection);
  screen.appendChild(body);
}

function pickCardFile(db) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,.txt,.json,.csv,.tsv";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleCardImport(db, file);
  };
  input.click();
}

function pickSnapshotFile(db) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleSnapshotImport(db, file);
  };
  input.click();
}

async function handleCardImport(db, file) {
  try {
    const text = await file.text();
    const kind = detectImportKind(file.name, text);

    if (kind === "snapshot") {
      showModal({
        title: "Wrong File Type",
        body: "This file is a full app snapshot. Use 'Restore from Snapshot' to restore it.",
        actions: [{ label: "OK", action: () => {} }]
      });
      return;
    }

    if (kind === "unsupported") {
      showModal({ title: "Unsupported File", body: "This file format is not supported.", actions: [{ label: "OK", action: () => {} }] });
      return;
    }

    let parsed;
    if (kind === "markdown-deck") {
      parsed = parseMarkdownDeck(text);
    } else if (kind === "json-card-import") {
      parsed = parseJsonCards(text);
    } else if (kind === "plain-text-card") {
      parsed = parsePlainTextCard(text, file.name);
    } else {
      showModal({ title: "Unsupported", body: `${kind} import is not yet supported.`, actions: [{ label: "OK", action: () => {} }] });
      return;
    }

    const { valid, errors } = validateImportedCards(parsed.cards);

    showImportPreview(db, parsed.deck ? [parsed.deck] : (parsed.decks || []), valid, errors);
  } catch (err) {
    showToast(`Import error: ${err.message}`, "error");
  }
}

function showImportPreview(db, decks, validCards, errors) {
  const bodyEl = el("div", { className: "import-preview" });

  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Decks found:"),
    el("span", { className: "preview-value" }, String(decks.length))
  ));
  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Cards to import:"),
    el("span", { className: "preview-value" }, String(validCards.length))
  ));
  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Standard cards:"),
    el("span", { className: "preview-value" }, String(validCards.filter(c => c.type === "standard").length))
  ));
  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Text-memory cards:"),
    el("span", { className: "preview-value" }, String(validCards.filter(c => c.type === "text-memory").length))
  ));

  if (errors.length > 0) {
    bodyEl.appendChild(el("div", { className: "preview-errors" },
      el("p", { className: "preview-error-title" }, `${errors.length} cards with errors (will be skipped):`),
      ...errors.map(e => el("p", { className: "preview-error-item" }, e.message))
    ));
  }

  showModal({
    title: "Import Preview",
    body: bodyEl,
    actions: [
      { label: "Cancel", action: () => {} },
      { label: `Import ${validCards.length} Cards`, primary: true, action: async () => {
        try {
          const result = await saveImportedCards(db, decks, validCards);
          showToast(`Imported ${result.imported} cards. ${result.skipped} duplicates skipped.`, "success");
          setScreen("library");
          renderLibraryScreen(db);
        } catch (err) {
          showToast(`Failed to save: ${err.message}`, "error");
        }
      }}
    ]
  });
}

async function handleSnapshotImport(db, file) {
  try {
    const text = await file.text();
    const snapshot = parseSnapshot(text);
    await validateSnapshot(snapshot);
    const preview = previewSnapshot(snapshot);
    showSnapshotPreview(db, snapshot, preview, file.name);
  } catch (err) {
    showModal({ title: "Invalid Snapshot", body: err.message, actions: [{ label: "OK", action: () => {} }] });
  }
}

function showSnapshotPreview(db, snapshot, preview, fileName) {
  const bodyEl = el("div", { className: "import-preview" });

  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Created:"),
    el("span", { className: "preview-value" }, formatDate(preview.createdAt))
  ));
  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Decks:"),
    el("span", { className: "preview-value" }, String(preview.deckCount))
  ));
  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Cards:"),
    el("span", { className: "preview-value" }, String(preview.cardCount))
  ));
  bodyEl.appendChild(el("div", { className: "preview-row" },
    el("span", { className: "preview-label" }, "Reviews:"),
    el("span", { className: "preview-value" }, String(preview.reviewCount))
  ));

  bodyEl.appendChild(el("p", { className: "preview-warning" },
    "⚠️ This will replace ALL local data. Your current data will be downloaded as an emergency backup first."
  ));

  showModal({
    title: "Restore Snapshot",
    body: bodyEl,
    actions: [
      { label: "Cancel", action: () => {} },
      { label: "Replace & Restore", danger: true, action: async () => {
        try {
          await replaceLocalDatabase(db, snapshot);
          showToast("Snapshot restored successfully.", "success");
          setScreen("library");
          renderLibraryScreen(db);
        } catch (err) {
          showToast(`Restore failed: ${err.message}`, "error");
        }
      }}
    ]
  });
}
