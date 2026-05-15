const APP_VERSION = "1.1.0";

const CHANGELOG = [
  {
    version: "1.1.0",
    date: "2026-05-15",
    items: [
      "New card type: Cloze deletion (Anki-style {{c1::...}} syntax, multi-group)",
      "Audio support — upload audio files or record in-app on any card side",
      "Reverse companion cards — auto-create a mirrored standard card",
      "Stats dashboard with review streaks, mastery, due forecast, and per-type filtering",
      "Search and tag filtering in the Library",
      "Encryption now covers cloze cards correctly"
    ]
  },
  {
    version: "1.0.0",
    date: "2026-04-01",
    items: [
      "Initial release: offline flashcard app with spaced repetition",
      "Standard, text-memory cards; markdown + LaTeX rendering",
      "Optional vault encryption; snapshot export / restore"
    ]
  }
];

function _changelogEntriesSince(lastSeenVersion) {
  if (!lastSeenVersion) return [];
  const idx = CHANGELOG.findIndex(e => e.version === lastSeenVersion);
  if (idx === -1) return CHANGELOG;
  return CHANGELOG.slice(0, idx);
}

function showChangelogModal(entries) {
  const list = entries && entries.length ? entries : CHANGELOG;
  const body = el("div", { className: "changelog-body" });
  for (const entry of list) {
    const block = el("div", { className: "changelog-entry" });
    block.appendChild(el("div", { className: "changelog-version" },
      el("strong", {}, `v${entry.version}`),
      el("span", { className: "changelog-date" }, entry.date)
    ));
    const ul = el("ul", { className: "changelog-list" });
    for (const item of entry.items) {
      ul.appendChild(el("li", {}, item));
    }
    block.appendChild(ul);
    body.appendChild(block);
  }
  showModal({
    title: "What's new",
    body,
    actions: [
      { label: "Got it", primary: true, action: () => {
        try { localStorage.setItem("lastSeenVersion", APP_VERSION); } catch {}
      }}
    ]
  });
}

function maybeShowChangelogOnBoot() {
  let lastSeen = null;
  try { lastSeen = localStorage.getItem("lastSeenVersion"); } catch {}
  if (lastSeen === APP_VERSION) return;
  if (!lastSeen) {
    try { localStorage.setItem("lastSeenVersion", APP_VERSION); } catch {}
    return;
  }
  const entries = _changelogEntriesSince(lastSeen);
  if (!entries.length) {
    try { localStorage.setItem("lastSeenVersion", APP_VERSION); } catch {}
    return;
  }
  showChangelogModal(entries);
}
