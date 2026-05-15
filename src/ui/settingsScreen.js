async function renderSettingsScreen(db) {
  const screen = document.getElementById("screen-settings");
  screen.innerHTML = "";

  const settings = (await repo.getSettings(db)) || {
    id: "global",
    dailyReviewLimit: 30,
    defaultNewCardsPerSession: 5,
    theme: "system",
    markdownMathEnabled: true,
    backupReminderEnabled: true
  };

  const header = el("div", { className: "screen-header" },
    el("button", { className: "btn btn--ghost", onClick: () => { setScreen("library"); renderLibraryScreen(db); } }, "← Back"),
    el("h1", {}, "Settings")
  );
  screen.appendChild(header);

  const form = el("div", { className: "settings-form" });

  function numField(label, id, value, min, max) {
    return el("div", { className: "form-row" },
      el("label", { className: "form-label" }, label),
      el("input", { type: "number", className: "form-input form-input--sm", id, value: String(value), min: String(min), max: String(max) })
    );
  }

  form.appendChild(numField("Daily Review Limit", "s-daily-limit", settings.dailyReviewLimit, 1, 200));
  form.appendChild(numField("New Cards per Session", "s-new-cards", settings.defaultNewCardsPerSession, 0, 50));

  // Theme
  const themeSelect = el("select", { className: "form-select", id: "s-theme" },
    el("option", { value: "system", ...(settings.theme === "system" ? { selected: "selected" } : {}) }, "System"),
    el("option", { value: "light", ...(settings.theme === "light" ? { selected: "selected" } : {}) }, "Light"),
    el("option", { value: "dark", ...(settings.theme === "dark" ? { selected: "selected" } : {}) }, "Dark")
  );
  form.appendChild(el("div", { className: "form-row" },
    el("label", { className: "form-label" }, "Theme"),
    themeSelect
  ));

  form.appendChild(el("button", { className: "btn btn--primary btn--lg", onClick: () => saveSettings(db, settings) }, "Save Settings"));

  // About / changelog section
  form.appendChild(el("hr", { style: "margin:1.5rem 0;border:none;border-top:1px solid var(--color-border, #e2e8f0)" }));
  form.appendChild(el("h3", { style: "margin-bottom:0.75rem;font-size:1rem" }, `About — v${APP_VERSION}`));
  form.appendChild(el("button", { className: "btn", onClick: () => showChangelogModal() }, "View changelog"));

  // Encryption section
  form.appendChild(el("hr", { style: "margin:1.5rem 0;border:none;border-top:1px solid var(--color-border, #e2e8f0)" }));
  form.appendChild(el("h3", { style: "margin-bottom:0.75rem;font-size:1rem" }, "Encryption"));

  if (!settings.encryptionEnabled) {
    form.appendChild(el("p", { style: "margin-bottom:0.75rem;font-size:0.875rem;color:var(--color-muted, #64748b)" },
      "Encrypt card content stored in your browser. You will need to enter a password each time you open the app."));
    form.appendChild(el("button", { className: "btn", onClick: () => showEnableEncryptionModal(db, settings) }, "Enable Encryption"));
  } else if (cryptoIsUnlocked()) {
    form.appendChild(el("p", { style: "margin-bottom:0.75rem;font-size:0.875rem;color:var(--color-muted, #64748b)" },
      "Encryption is enabled. Card content is encrypted at rest."));
    form.appendChild(el("div", { style: "display:flex;gap:0.5rem;flex-wrap:wrap" },
      el("button", { className: "btn", onClick: () => showChangePasswordModal(db, settings) }, "Change Password"),
      el("button", { className: "btn btn--ghost btn--danger-ghost", onClick: () => showDisableEncryptionModal(db, settings) }, "Disable Encryption")
    ));
  } else {
    form.appendChild(el("p", {}, "Vault is locked. Reload the page to unlock."));
  }

  screen.appendChild(form);
}

async function saveSettings(db, existing) {
  const current = (await repo.getSettings(db)) || existing;
  const updated = {
    ...current,
    id: "global",
    dailyReviewLimit: parseInt(document.getElementById("s-daily-limit").value) || 30,
    defaultNewCardsPerSession: parseInt(document.getElementById("s-new-cards").value) || 5,
    theme: document.getElementById("s-theme").value,
    updatedAt: now()
  };

  await repo.putSettings(db, updated);
  applyTheme(updated.theme);
  showToast("Settings saved.");
  setScreen("library");
  renderLibraryScreen(db);
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  if (theme === "light") root.setAttribute("data-theme", "light");
  else if (theme === "dark") root.setAttribute("data-theme", "dark");
}

async function _encryptAllCards(db) {
  const cards = (await repo.getAllCards(db)).filter(c => !c.deletedAt);
  for (const card of cards) {
    if (!card.standardCard?.encrypted && !card.textMemoryCard?.encrypted && !card.clozeCard?.encrypted) {
      const enc = await encryptCardData(card);
      await repo.putCard(db, { ...enc, updatedAt: now() });
    }
  }
}

async function _decryptAllCards(db) {
  const cards = (await repo.getAllCards(db)).filter(c => !c.deletedAt);
  for (const card of cards) {
    if (card.standardCard?.encrypted || card.textMemoryCard?.encrypted || card.clozeCard?.encrypted) {
      const dec = await decryptCardData(card);
      if (dec) await repo.putCard(db, { ...dec, updatedAt: now() });
    }
  }
}

async function _encryptAllDecks(db) {
  const decks = (await repo.getAllDecks(db)).filter(d => !d.deletedAt);
  for (const deck of decks) {
    if (!deck.encryptedName) {
      const enc = await encryptDeck(deck);
      await repo.putDeck(db, { ...enc, updatedAt: now() });
    }
  }
}

async function _decryptAllDecks(db) {
  const decks = (await repo.getAllDecks(db)).filter(d => !d.deletedAt);
  for (const deck of decks) {
    if (deck.encryptedName) {
      const dec = await decryptDeck(deck);
      if (dec) await repo.putDeck(db, { ...dec, encryptedName: null, updatedAt: now() });
    }
  }
}

function showEnableEncryptionModal(db, settings) {
  const errEl = el("p", {});
  errEl.style.cssText = "color:var(--color-danger);min-height:1.2rem;font-size:0.875rem;margin-top:0.25rem";
  const pw1 = el("input", { type: "password", className: "form-input", placeholder: "New password" });
  const pw2 = el("input", { type: "password", className: "form-input", placeholder: "Confirm password" });

  async function submit() {
    errEl.textContent = "";
    const p1 = pw1.value, p2 = pw2.value;
    if (!p1) { errEl.textContent = "Password cannot be empty."; return; }
    if (p1 !== p2) { errEl.textContent = "Passwords do not match."; pw2.value = ""; pw2.focus(); return; }
    try {
      const { salt, verifyEnvelope } = await cryptoSetupKey(p1);
      await _encryptAllCards(db);
      await _encryptAllDecks(db);
      const updated = {
        ...settings, id: "global",
        encryptionEnabled: true, encryptionSalt: salt, encryptionVerify: verifyEnvelope,
        updatedAt: now()
      };
      await repo.putSettings(db, updated);
      overlay.remove();
      showToast("Encryption enabled.");
      renderSettingsScreen(db);
    } catch (e) {
      errEl.textContent = e.message || "Failed to enable encryption.";
    }
  }

  pw1.addEventListener("keydown", e => { if (e.key === "Enter") pw2.focus(); });
  pw2.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

  const overlay = el("div", { className: "modal-overlay" });
  overlay.appendChild(
    el("div", { className: "modal-dialog" },
      el("h2", { className: "modal-title" }, "Enable Encryption"),
      el("div", { className: "modal-body" },
        el("p", {}, "Enter a password to encrypt card content stored in your browser."),
        el("div", { className: "form-row" }, el("label", { className: "form-label" }, "Password"), pw1),
        el("div", { className: "form-row" }, el("label", { className: "form-label" }, "Confirm"), pw2),
        errEl
      ),
      el("div", { className: "modal-footer" },
        el("button", { className: "btn", onClick: () => overlay.remove() }, "Cancel"),
        el("button", { className: "btn btn--primary", onClick: submit }, "Enable")
      )
    )
  );
  document.getElementById("modal-container").appendChild(overlay);
  setTimeout(() => pw1.focus(), 50);
}

function showChangePasswordModal(db, settings) {
  const errEl = el("p", {});
  errEl.style.cssText = "color:var(--color-danger);min-height:1.2rem;font-size:0.875rem;margin-top:0.25rem";
  const pw1 = el("input", { type: "password", className: "form-input", placeholder: "New password" });
  const pw2 = el("input", { type: "password", className: "form-input", placeholder: "Confirm new password" });

  async function submit() {
    errEl.textContent = "";
    const p1 = pw1.value, p2 = pw2.value;
    if (!p1) { errEl.textContent = "Password cannot be empty."; return; }
    if (p1 !== p2) { errEl.textContent = "Passwords do not match."; pw2.value = ""; pw2.focus(); return; }
    try {
      await _decryptAllCards(db);
      await _decryptAllDecks(db);
      const { salt, verifyEnvelope } = await cryptoSetupKey(p1);
      await _encryptAllCards(db);
      await _encryptAllDecks(db);
      const updated = { ...settings, id: "global", encryptionSalt: salt, encryptionVerify: verifyEnvelope, updatedAt: now() };
      await repo.putSettings(db, updated);
      overlay.remove();
      showToast("Password changed.");
      renderSettingsScreen(db);
    } catch (e) {
      errEl.textContent = e.message || "Failed to change password.";
    }
  }

  pw1.addEventListener("keydown", e => { if (e.key === "Enter") pw2.focus(); });
  pw2.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

  const overlay = el("div", { className: "modal-overlay" });
  overlay.appendChild(
    el("div", { className: "modal-dialog" },
      el("h2", { className: "modal-title" }, "Change Password"),
      el("div", { className: "modal-body" },
        el("p", {}, "Enter a new password for card encryption."),
        el("div", { className: "form-row" }, el("label", { className: "form-label" }, "New password"), pw1),
        el("div", { className: "form-row" }, el("label", { className: "form-label" }, "Confirm"), pw2),
        errEl
      ),
      el("div", { className: "modal-footer" },
        el("button", { className: "btn", onClick: () => overlay.remove() }, "Cancel"),
        el("button", { className: "btn btn--primary", onClick: submit }, "Change")
      )
    )
  );
  document.getElementById("modal-container").appendChild(overlay);
  setTimeout(() => pw1.focus(), 50);
}

function showDisableEncryptionModal(db, settings) {
  confirmModal(
    "Disable encryption? All card content will be stored unencrypted in your browser.",
    async () => {
      await _decryptAllCards(db);
      await _decryptAllDecks(db);
      const updated = {
        ...settings, id: "global",
        encryptionEnabled: false, encryptionSalt: null, encryptionVerify: null,
        updatedAt: now()
      };
      await repo.putSettings(db, updated);
      cryptoClearKey();
      showToast("Encryption disabled.");
      renderSettingsScreen(db);
    }
  );
}
