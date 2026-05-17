async function decryptCard(card) {
  if (!card) return null;
  if (
    !card.standardCard?.encrypted &&
    !card.textMemoryCard?.encrypted &&
    !card.clozeCard?.encrypted
  ) return card;
  return decryptCardData(card);
}

async function renderReviewScreen(db) {
  const screen = document.getElementById("screen-review");
  screen.innerHTML = "";

  const rawCard = reviewController.currentCard();
  if (!rawCard || reviewController.isComplete()) {
    screen.appendChild(renderSessionComplete(db));
    return;
  }

  const card = await decryptCard(rawCard);
  if (!card) {
    screen.appendChild(el("div", { className: "empty-state" },
      el("p", {}, "Cannot decrypt card — vault may be locked."),
      el("button", { className: "btn btn--primary", onClick: () => { setScreen("library"); renderLibraryScreen(db); } }, "Back to Library")
    ));
    return;
  }

  const header = el("div", { className: "review-header" },
    el("button", { className: "btn btn--ghost btn--sm", onClick: () => endSession(db) }, "End Session"),
    el("div", { className: "review-progress" },
      `${reviewController.session.record.cardsReviewed.length} reviewed`),
    helpButton(db, "reviewing")
  );
  screen.appendChild(header);

  if (card.type === "standard") {
    renderStandardReview(db, screen, card);
  } else if (card.type === "cloze") {
    renderClozeReview(db, screen, card);
  } else {
    renderTextMemoryReviewUI(db, screen, card);
  }
}

function renderSessionComplete(db) {
  const wrap = el("div", { className: "session-complete" },
    el("h2", {}, "Session Complete!"),
    el("p", {}, "Great work."),
    el("button", { className: "btn btn--primary", onClick: () => {
      setScreen("library");
      renderLibraryScreen(db);
    }}, "Back to Library")
  );
  return wrap;
}

async function endSession(db) {
  const sess = reviewController.session;
  const remaining = sess
    ? (sess.queue.length - sess.index) + sess.failedCards.length
    : 0;

  if (remaining > 0) {
    confirmModal(
      `End session? ${remaining} card${remaining === 1 ? "" : "s"} still remaining.`,
      async () => {
        await reviewController.endSession();
        setScreen("library");
        renderLibraryScreen(db);
      }
    );
  } else {
    await reviewController.endSession();
    setScreen("library");
    renderLibraryScreen(db);
  }
}

// --- Standard card review ---
function renderStandardReview(db, screen, card) {
  let reviewState = standardReviewState.create(card);

  const cardArea = el("div", { className: "card-area" });
  const controls = el("div", { className: "review-controls review-controls--sticky" });

  function render() {
    cardArea.innerHTML = "";
    controls.innerHTML = "";

    for (let i = 0; i < reviewState.revealedCount; i++) {
      if (i > 0) cardArea.appendChild(el("div", { className: "card-divider" }));
      cardArea.appendChild(renderStandardSide(card, i));
    }

    if (reviewState.phase === "hidden") {
      const remaining = reviewState.totalSides - reviewState.revealedCount;
      const label = remaining === 1 ? "Show Next (Space)" : `Show Next — ${remaining} more (Space)`;
      controls.appendChild(el("button", { className: "btn btn--primary btn--lg", onClick: reveal }, label));
    } else {
      renderRatingButtons(controls, async (rating) => {
        await submitStandardRating(db, card, rating);
      });
    }
  }

  function reveal() {
    if (reviewState.phase === "hidden") {
      reviewState = standardReviewState.reveal(reviewState);
      render();
    }
  }

  screen.appendChild(cardArea);
  screen.appendChild(controls);
  render();
  setupStandardKeyboard(reveal, async (rating) => {
    if (reviewState.phase !== "revealed") return;
    await submitStandardRating(db, card, rating);
  });
}

async function submitStandardRating(db, card, rating) {
  await reviewController.submitRating(rating);
  removeKeyboardHandler();
  renderReviewScreen(db);
}

function renderRatingButtons(container, onRate) {
  const ratings = [
    { key: "1", label: "Again", value: "again", cls: "btn--danger" },
    { key: "2", label: "Hard", value: "hard", cls: "btn--warning" },
    { key: "3", label: "Good", value: "good", cls: "btn--primary" },
    { key: "4", label: "Easy", value: "easy", cls: "btn--success" },
    { key: "5", label: "Perfect", value: "perfect", cls: "btn--success btn--glow" }
  ];
  const row = el("div", { className: "rating-row" });
  for (const r of ratings) {
    row.appendChild(el("button", { className: `btn ${r.cls}`, onClick: () => onRate(r.value) },
      `${r.label} (${r.key})`));
  }
  container.appendChild(row);
}

// --- Cloze review ---
function renderClozeReview(db, screen, card) {
  const activeGroup = card.activeClozeGroup;
  let reviewState = clozeReviewState.create(card, activeGroup);

  const cardArea = el("div", { className: "card-area" });
  const controls = el("div", { className: "review-controls review-controls--sticky" });

  function render() {
    cardArea.innerHTML = "";
    controls.innerHTML = "";

    if (reviewState.phase === "hidden") {
      cardArea.appendChild(renderClozeFront(card, activeGroup));
      controls.appendChild(el("button", {
        className: "btn btn--primary btn--lg",
        onClick: reveal
      }, "Show Answer (Space)"));
    } else {
      cardArea.appendChild(renderClozeBack(card, activeGroup));
      renderRatingButtons(controls, async (rating) => {
        await submitClozeRating(db, rating);
      });
    }
  }

  function reveal() {
    if (reviewState.phase === "hidden") {
      reviewState = clozeReviewState.reveal(reviewState);
      render();
    }
  }

  screen.appendChild(cardArea);
  screen.appendChild(controls);
  render();
  setupStandardKeyboard(reveal, async (rating) => {
    if (reviewState.phase !== "revealed") return;
    await submitClozeRating(db, rating);
  });
}

async function submitClozeRating(db, rating) {
  await reviewController.submitRating(rating);
  removeKeyboardHandler();
  renderReviewScreen(db);
}

// --- Text memory review ---
function renderTextMemoryReviewUI(db, screen, card) {
  let state = textMemoryReview.create(card);

  const cardArea = el("div", { className: "card-area" });
  const controls = el("div", { className: "review-controls review-controls--sticky" });

  function render() {
    cardArea.innerHTML = "";
    controls.innerHTML = "";

    const tokens = state.phase === "blinding"
      ? state.suggestedTokens
      : card.textMemoryCard.tokens;

    cardArea.appendChild(renderTokens(tokens, {
      tempRevealed: state.tempRevealed,
      phase: state.phase,
      customizing: state.customizing,
      peekAll: state.peekAll,
      brush: state.brush,
      onWordClick: (idx) => {
        if (state.phase === "blinding" && state.customizing) {
          state = textMemoryReview.paintWord(state, idx);
        } else if (state.phase === "recall") {
          state = textMemoryReview.clickWord(state, idx);
        }
        render();
      }
    }));

    if (state.phase === "recall") {
      const peekLabel = state.peekAll ? "Hide Full Text (P)" : "Peek Full Text (P)";
      controls.appendChild(el("button", { className: "btn btn--ghost", onClick: () => {
        state = textMemoryReview.togglePeekAll(state);
        render();
      }}, peekLabel));
      controls.appendChild(el("button", { className: "btn btn--primary btn--lg", onClick: () => {
        state = textMemoryReview.showFullText(state);
        render();
      }}, "Show Full Text (Space)"));
    } else if (state.phase === "revealed") {
      controls.appendChild(el("p", { className: "review-hint" }, "How well did you recall the passage?"));
      renderRatingButtons(controls, async (rating) => {
        state = textMemoryReview.rate(state, rating);
        render();
      });
    } else if (state.phase === "blinding") {
      const blindActions = el("div", { className: "blinding-actions" });

      blindActions.appendChild(el("p", { className: "review-hint" }, "Suggested next difficulty:"));
      const btnRow = el("div", { className: "blinding-btn-row" });
      btnRow.appendChild(el("button", { className: "btn", onClick: () => { state = textMemoryReview.makeEasier(state); render(); } }, "Easier (E)"));
      btnRow.appendChild(el("button", { className: "btn", onClick: () => { state = textMemoryReview.makeHarder(state); render(); } }, "Harder (H)"));
      btnRow.appendChild(el("button", { className: "btn", onClick: () => { state = textMemoryReview.startCustomizing(state); render(); } }, "Customize (C)"));
      btnRow.appendChild(el("button", { className: "btn btn--primary", onClick: async () => {
        await commitBlinding(db, card, state);
      }}, "Accept (K)"));
      blindActions.appendChild(btnRow);

      if (state.customizing) {
        blindActions.appendChild(renderCustomizeToolbar(state, (next) => { state = next; render(); }));
      }

      controls.appendChild(blindActions);
    }
  }

  screen.appendChild(cardArea);
  screen.appendChild(controls);
  render();
  setupTextMemoryKeyboard(
    () => { if (state.phase === "recall") { state = textMemoryReview.showFullText(state); render(); } },
    async (rating) => { if (state.phase === "revealed") { state = textMemoryReview.rate(state, rating); render(); } },
    {
      k: async () => { if (state.phase === "blinding") await commitBlinding(db, card, state); },
      e: () => { if (state.phase === "blinding") { state = textMemoryReview.makeEasier(state); render(); } },
      h: () => { if (state.phase === "blinding") { state = textMemoryReview.makeHarder(state); render(); } },
      c: () => { if (state.phase === "blinding") { state = textMemoryReview.startCustomizing(state); render(); } },
      p: () => { if (state.phase === "recall") { state = textMemoryReview.togglePeekAll(state); render(); } },
      f: () => { if (state.phase === "blinding" && state.customizing) { state = textMemoryReview.setBrush(state, "full"); render(); } },
      l: () => { if (state.phase === "blinding" && state.customizing) { state = textMemoryReview.setBrush(state, "letter"); render(); } },
      b: () => { if (state.phase === "blinding" && state.customizing) { state = textMemoryReview.setBrush(state, "blind"); render(); } }
    }
  );
}

function renderCustomizeToolbar(state, onChange) {
  const wrap = el("div", { className: "customize-toolbar" });

  const brushLabels = { full: "Full", letter: "Letter", blind: "Hidden" };
  const brushKeys = { full: "F", letter: "L", blind: "B" };
  const brushModes = ["full", "letter", "blind"];

  // Paint row
  const paintRow = el("div", { className: "customize-row" },
    el("span", { className: "customize-row__label" }, "Paint:")
  );
  for (const mode of brushModes) {
    const chip = el("button", {
      type: "button",
      className: `brush-chip brush-${mode}${state.brush === mode ? " is-active" : ""}`,
      "aria-pressed": state.brush === mode ? "true" : "false",
      onClick: () => onChange(textMemoryReview.setBrush(state, mode))
    }, `${brushLabels[mode]} (${brushKeys[mode]})`);
    paintRow.appendChild(chip);
  }
  wrap.appendChild(paintRow);

  // Set-all row
  const bulkRow = el("div", { className: "customize-row" },
    el("span", { className: "customize-row__label" }, "Set all →")
  );
  for (const mode of brushModes) {
    const btn = el("button", {
      type: "button",
      className: `bulk-btn bulk-${mode}`,
      onClick: () => onChange(textMemoryReview.setAllTo(state, mode))
    }, brushLabels[mode]);
    bulkRow.appendChild(btn);
  }
  wrap.appendChild(bulkRow);

  // Hint
  wrap.appendChild(el("p", { className: "review-hint review-hint--small customize-hint" },
    `Tap words to paint them as ${brushLabels[state.brush] || "—"}.`));

  return wrap;
}

async function commitBlinding(db, card, state) {
  const updatedCard = {
    ...card,
    textMemoryCard: { ...card.textMemoryCard, tokens: state.suggestedTokens },
    updatedAt: now()
  };
  let cardToSave = updatedCard;
  if (cryptoIsUnlocked()) cardToSave = await encryptCardData(updatedCard);
  await repo.putCard(db, cardToSave);
  // Sync the queue entry's card so submitRating uses the updated form (not the
  // stale pre-blinding version).
  const entry = reviewController.currentEntry();
  if (entry) entry.card = cardToSave;
  await reviewController.submitRating(state.rating);
  removeKeyboardHandler();
  renderReviewScreen(db);
}

// --- Keyboard handling ---
let _keyHandler = null;

function removeKeyboardHandler() {
  if (_keyHandler) {
    document.removeEventListener("keydown", _keyHandler);
    _keyHandler = null;
  }
}

function setupStandardKeyboard(onReveal, onRate) {
  removeKeyboardHandler();
  _keyHandler = (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); onReveal(); }
    if (e.key === "1") onRate("again");
    if (e.key === "2") onRate("hard");
    if (e.key === "3") onRate("good");
    if (e.key === "4") onRate("easy");
    if (e.key === "5") onRate("perfect");
  };
  document.addEventListener("keydown", _keyHandler);
}

function setupTextMemoryKeyboard(onReveal, onRate, blindingKeys = {}) {
  removeKeyboardHandler();
  _keyHandler = (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); onReveal(); }
    if (e.key === "1") onRate("again");
    if (e.key === "2") onRate("hard");
    if (e.key === "3") onRate("good");
    if (e.key === "4") onRate("easy");
    if (e.key === "5") onRate("perfect");
    if (e.key === "k" || e.key === "K") blindingKeys.k && blindingKeys.k();
    if (e.key === "e" || e.key === "E") blindingKeys.e && blindingKeys.e();
    if (e.key === "h" || e.key === "H") blindingKeys.h && blindingKeys.h();
    if (e.key === "c" || e.key === "C") blindingKeys.c && blindingKeys.c();
    if (e.key === "p" || e.key === "P") blindingKeys.p && blindingKeys.p();
    if (e.key === "f" || e.key === "F") blindingKeys.f && blindingKeys.f();
    if (e.key === "l" || e.key === "L") blindingKeys.l && blindingKeys.l();
    if (e.key === "b" || e.key === "B") blindingKeys.b && blindingKeys.b();
  };
  document.addEventListener("keydown", _keyHandler);
}
