function guardedNav(db, action) {
  if (appState.currentScreen === "review" && reviewController.session) {
    confirmModal(
      "Leave review session? The current card's progress will not be saved.",
      async () => { await reviewController.endSession(); action(); }
    );
  } else {
    action();
  }
}

function showUnlockModal(settings) {
  return new Promise(resolve => {
    const errEl = el("p", {});
    errEl.style.cssText = "color:var(--color-danger);min-height:1.2rem;font-size:0.875rem;margin-top:0.5rem";
    const pwInput = el("input", { type: "password", className: "form-input", placeholder: "Vault password" });

    async function tryUnlock() {
      const pw = pwInput.value;
      if (!pw) return;
      try {
        await cryptoUnlock(pw, settings.encryptionSalt, settings.encryptionVerify);
        overlay.remove();
        resolve();
      } catch {
        errEl.textContent = "Incorrect password. Try again.";
        pwInput.value = "";
        pwInput.focus();
      }
    }

    pwInput.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });

    const overlay = el("div", { className: "modal-overlay" });
    overlay.appendChild(
      el("div", { className: "modal-dialog" },
        el("h2", { className: "modal-title" }, "Unlock Vault"),
        el("div", { className: "modal-body" },
          el("p", {}, "Card content is encrypted. Enter your password to continue."),
          pwInput,
          errEl
        ),
        el("div", { className: "modal-footer" },
          el("button", { className: "btn btn--primary", onClick: tryUnlock }, "Unlock")
        )
      )
    );
    document.getElementById("modal-container").appendChild(overlay);
    setTimeout(() => pwInput.focus(), 50);
  });
}

async function init() {
  const db = await openDB();

  // Apply saved theme
  const settings = await repo.getSettings(db);
  if (settings) applyTheme(settings.theme || "system");

  // Unlock vault if encryption is enabled
  if (settings && settings.encryptionEnabled) {
    await showUnlockModal(settings);
  }

  // Default screen
  setScreen("library");
  renderLibraryScreen(db);

  // Nav bar
  document.getElementById("nav-library").addEventListener("click", () =>
    guardedNav(db, () => { setScreen("library"); renderLibraryScreen(db); }));
  document.getElementById("nav-import").addEventListener("click", () =>
    guardedNav(db, () => { setScreen("import"); renderImportScreen(db); }));
  document.getElementById("nav-export").addEventListener("click", () =>
    guardedNav(db, () => { setScreen("export"); renderExportScreen(db); }));
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error("App init failed:", err);
    document.getElementById("app").textContent = "Failed to initialize app: " + err.message;
  });
});
