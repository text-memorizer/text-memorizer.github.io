async function renderExportScreen(db) {
  const screen = document.getElementById("screen-export");
  screen.innerHTML = "";

  const syncLog = await repo.getAllSyncLog(db);
  const lastExport = syncLog.filter(e => e.type === "export").sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))[0];
  const lastImport = syncLog.filter(e => e.type === "import").sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))[0];

  const header = el("div", { className: "screen-header" },
    el("button", { className: "btn btn--ghost", onClick: () => { setScreen("library"); renderLibraryScreen(db); } }, "← Back"),
    el("h1", {}, "Backup & Transfer")
  );
  screen.appendChild(header);

  const body = el("div", { className: "export-body" });

  // Export section
  const exportSection = el("div", { className: "export-section" },
    el("h2", {}, "Export Snapshot"),
    el("p", { className: "export-hint" }, "Creates a full backup of all your cards, decks, and progress."),
    el("p", { className: "export-warning" }, "⚠️ This backup file is not encrypted. Anyone who can open it can read your cards and progress."),
    el("div", { className: "sync-meta" },
      el("span", {}, "Last exported: " + (lastExport ? formatDate(lastExport.happenedAt) : "Never"))
    ),
    el("button", { className: "btn btn--primary btn--lg", onClick: () => doExport(db) }, "Export Snapshot")
  );

  // Sync guidance
  const guideSection = el("div", { className: "export-section" },
    el("h2", {}, "Multi-Device Transfer"),
    el("div", { className: "export-guide" },
      el("p", {}, "This app does not sync automatically. To move between devices:"),
      el("ol", {},
        el("li", {}, "Export a snapshot from the current device."),
        el("li", {}, "Save it to Google Drive."),
        el("li", {}, "Open the app on the other device."),
        el("li", {}, "Go to Import → Restore from Snapshot.")
      ),
      el("p", { className: "export-hint" }, "Recommended: use one active device at a time. Export before switching.")
    )
  );

  // Import shortcut
  const importSection = el("div", { className: "export-section" },
    el("h2", {}, "Restore from Snapshot"),
    el("div", { className: "sync-meta" },
      el("span", {}, "Last imported: " + (lastImport ? formatDate(lastImport.happenedAt) : "Never"))
    ),
    el("button", { className: "btn btn--danger btn--lg", onClick: () => { setScreen("import"); renderImportScreen(db); } }, "Restore Snapshot →")
  );

  body.appendChild(exportSection);
  body.appendChild(guideSection);
  body.appendChild(importSection);
  screen.appendChild(body);
}

async function doExport(db) {
  try {
    const snapshot = await exportSnapshot(db);
    const file = snapshotToFile(snapshot);
    const result = await shareOrDownload(file);
    if (result !== "cancelled") {
      await logSyncEvent(db, "export", snapshot.snapshotId, "success");
      showToast("Snapshot exported!", "success");
      renderExportScreen(db);
    }
  } catch (err) {
    showToast(`Export failed: ${err.message}`, "error");
  }
}
