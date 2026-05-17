// All in-app documentation. Each topic is rendered through renderMarkdown()
// (marked + DOMPurify + KaTeX), so markdown / $math$ / fenced code all work.
// Keep ids stable — they're referenced by helpButton(topicId) call sites.

const HELP_GROUPS = [
  { id: "getting-started", title: "Getting started" },
  { id: "card-types",      title: "Card types" },
  { id: "reviewing",       title: "Reviewing" },
  { id: "library",         title: "Library & decks" },
  { id: "stats",           title: "Stats" },
  { id: "import-backup",   title: "Import & backup" },
  { id: "sync-folder",     title: "Sync folder" },
  { id: "settings",        title: "Settings & encryption" },
  { id: "how-it-works",    title: "How it works" },
  { id: "data",            title: "Data & storage" },
  { id: "reference",       title: "Reference" }
];

const HELP_TOPICS = [
  // ── Getting started ─────────────────────────────────────────────────────
  {
    id: "welcome",
    group: "getting-started",
    title: "Welcome",
    markdown: `
# Welcome

Text Memorizer is an **offline-first** flashcard app for memorizing facts, passages, and Q&A pairs using spaced repetition.

- Everything lives in **your browser** (IndexedDB). No account, no server.
- The app works **offline** once loaded — install it as a PWA for the smoothest experience.
- Because your data is local, **back up often**. See *Backup & sync* below.

If this is your first visit, start with the *Quick tour* and *Your first card* topics.
`.trim()
  },
  {
    id: "quick-tour",
    group: "getting-started",
    title: "Quick tour",
    markdown: `
# Quick tour

The top nav has four tabs:

- **Library** — your decks and cards. Create, edit, search, and start reviews here.
- **Stats** — streaks, mastery distribution, due forecast, ratings breakdown.
- **Import** — bring in markdown decks, plain text, JSON, or restore a snapshot backup.
- **Backup** — export a snapshot, connect a sync folder, or jump to restore.

The Library header also has **Settings** (theme, daily limits, encryption) and **Help** (this screen).

During a review, keyboard shortcuts speed things up — see *Keyboard shortcuts*.
`.trim()
  },
  {
    id: "first-card",
    group: "getting-started",
    title: "Your first card",
    markdown: `
# Your first card

1. From the **Library**, click **+ Card**.
2. Choose a **card type** (Standard is a good start).
3. Give it a **title**, pick or create a **deck**, optionally add **tags** (comma-separated).
4. Fill in the card sides. Markdown and \`$math$\` work.
5. Click **Save Card**.

Once a deck has cards, click **Review** on the deck row in the Library to start a session.
`.trim()
  },

  // ── Card types ──────────────────────────────────────────────────────────
  {
    id: "card-standard",
    group: "card-types",
    title: "Standard flashcard",
    markdown: `
# Standard flashcard

The classic front/back card, but with **2+ sides**. Use it for vocabulary, definitions, formulas, Q&A.

- Each side accepts **markdown** and \`$math$\` ([more on syntax](#topic-markdown-and-math)).
- Press **+ Image** to attach an image (or paste/drag an image right into the textarea — it's stored as base64 inside the card).
- Press **+ Audio** to attach an audio file, or **Record** to record one in-app ([details](#topic-card-audio)).
- Use ↑ / ↓ to reorder sides, **Remove** to delete one.
- Tick **Also create reverse companion** to auto-create a mirrored card ([details](#topic-card-reverse)).

During review, you see side 1, then reveal subsequent sides one by one, then rate the whole card.
`.trim()
  },
  {
    id: "card-text-memory",
    group: "card-types",
    title: "Text memorization",
    markdown: `
# Text memorization

Paste a passage you want to memorize word-for-word — a poem, a definition, a speech opening — and the app reveals it progressively.

**Blinding modes** during review:
- **Easy** — full text shown; warmup.
- **Letter hint** — first letter visible, rest hidden.
- **Blind** — words hidden entirely.

The app picks a default mode based on each word's mastery. Before rating, you can adjust:
- **K** keep • **E** easier • **H** harder • **C** customize

In customize mode, pick a target state with **F** (Full), **L** (Letter), or **B** (Blind), then tap words to paint them. Use **Set all → Full / Letter / Hidden** to bulk-overwrite every word at once.

The app tracks mastery **per word**, so the words you stumble on are blinded more aggressively next time. See [Adaptive blinding](#topic-adaptive-blinding-deep) for the full mechanics.
`.trim()
  },
  {
    id: "card-cloze",
    group: "card-types",
    title: "Cloze deletion",
    markdown: `
# Cloze deletion

Anki-style fill-in-the-blank cards. Write a passage and wrap the bits you want to hide:

\`\`\`
The capital of {{c1::France}} is {{c2::Paris::city}}.
\`\`\`

- \`{{c1::answer}}\` — a basic cloze.
- \`{{c1::answer::hint}}\` — same, with a hint shown in the blank.
- Multiple groups (\`c1\`, \`c2\`, …) become **independent review entries** — each has its own schedule and mastery.
- Reuse a group name (e.g. \`c1\` twice) to hide multiple spans together.

The editor shows a live preview of detected groups and the fully-revealed back text. The card's overall mastery is the average across its groups.
`.trim()
  },
  {
    id: "card-audio",
    group: "card-types",
    title: "Audio in cards",
    markdown: `
# Audio in cards

Any card side (standard, text, cloze) can embed audio.

- **+ Audio** uploads a file from disk.
- **Record** opens a recorder modal — record straight from the mic, preview, then insert.
- Files are stored **inline as base64** inside the card, so they ship with the snapshot.
- Limit: **10 MB per clip**. Larger files are rejected. Prefer \`.webm\`, \`.ogg\`, \`.m4a\`, \`.mp3\`.

The clip plays inline during review with standard browser audio controls.
`.trim()
  },
  {
    id: "card-reverse",
    group: "card-types",
    title: "Reverse companion cards",
    markdown: `
# Reverse companion cards

For standard cards only. Tick **Also create reverse companion** on save and the app creates a second, linked card with sides reversed:

- Original: *Side 1 → Side 2*
- Companion: *Side 2 → Side 1*

The companion is independently scheduled (they're separate cards) but the link is tracked. If you edit the companion's source card, the editor shows a hint and won't let you create a duplicate. Deleting the source can also clean up the companion.
`.trim()
  },
  {
    id: "markdown-and-math",
    group: "card-types",
    title: "Markdown & math",
    markdown: `
# Markdown & math

Card content is rendered with **marked** + **DOMPurify** + **KaTeX**.

Supported:
- Standard markdown: headings, lists, **bold**, *italic*, \`code\`, fenced code blocks, links, blockquotes, tables.
- Images (\`![alt](url)\`) — incl. base64 \`data:\` URIs.
- Audio via \`<audio>\` tags (auto-inserted by + Audio / Record).
- Math: \`$inline$\` and \`$$display$$\` with KaTeX. Example: $E = mc^2$.

You can disable math rendering in *Settings* if you want \`$...$\` to render literally.

HTML is sanitized — \`<script>\` and other dangerous tags are stripped, so pasting in untrusted markdown is safe.
`.trim()
  },

  // ── Reviewing ───────────────────────────────────────────────────────────
  {
    id: "reviewing",
    group: "reviewing",
    title: "Review sessions",
    markdown: `
# Review sessions

A session is built from three buckets, in order:

1. **Due** cards — past their \`nextDueAt\` timestamp.
2. **Failed-recently** cards — flagged after an *Again* rating, even if their next due date is in the future.
3. **New** cards — never reviewed; capped at *New cards per session* (Settings).

The total is capped at *Daily review limit* (Settings, default 30). The header shows how many you've already reviewed in this session.

**End session** prompts a confirm if there are cards left. Otherwise the session closes silently and you return to the Library.

Failed cards loop back into the queue within the same session, so you'll see them again before you're done.
`.trim()
  },
  {
    id: "ratings",
    group: "reviewing",
    title: "Ratings (Again / Hard / Good / Easy / Perfect)",
    markdown: `
# Ratings

After you reveal a card, pick the rating that matches your recall:

| Rating | Meaning | Effect on schedule |
|---|---|---|
| **Again** | Failed — couldn't recall | Interval drops to ~6 hours, ease decreases |
| **Hard** | Recalled but with effort | Interval grows slowly (× 1.2) |
| **Good** | Recalled comfortably | Interval × current ease (~2.5×) |
| **Easy** | Recalled with no hesitation | Interval × ease × 1.4, ease bumps up |
| **Perfect** | Knew it cold, no thought | Interval × ease × 1.8, ease bumps up more |

There's no "right" rating — be honest. The system tunes intervals around how *you* rate, so consistent self-grading matters more than picking the "best" word.

See [How spaced repetition works](#topic-sr-algorithm) for the exact mechanics.
`.trim()
  },
  {
    id: "keyboard",
    group: "reviewing",
    title: "Keyboard shortcuts",
    markdown: `
# Keyboard shortcuts

**During review:**

| Key | Action |
|---|---|
| **Space** | Reveal next side (standard) / reveal answer |
| **1** | Rate *Again* |
| **2** | Rate *Hard* |
| **3** | Rate *Good* |
| **4** | Rate *Easy* |
| **5** | Rate *Perfect* |

**Text memorization extras:**

| Key | Action |
|---|---|
| **P** | Peek full text (toggle) — during recall, flip between blinded and full |
| **K** | Keep current blinding — between reveal and rating |
| **E** | Make easier — between reveal and rating |
| **H** | Make harder — between reveal and rating |
| **C** | Customize — between reveal and rating |
| **F / L / B** | Set paint brush to Full / Letter / Blind — while customizing |
`.trim()
  },
  {
    id: "adaptive-blinding",
    group: "reviewing",
    title: "Adaptive word blinding",
    markdown: `
# Adaptive word blinding

For *Text memorization* cards, the app tracks mastery **per word**. The next time you see the card:

- Well-mastered words get **lighter hints** (or stay visible).
- Words you missed get **stronger blinding** (full hide, letter-only hints).

The K / E / H / C controls let you override the suggestion *before* you rate the card. C opens **customize mode**: pick a target state (F / L / B) and tap words to paint them, or use **Set all** to bulk-shift every word. The rating updates per-word stats — words you stumbled over during recall get a mastery hit.

For the full algorithm see [Adaptive blinding internals](#topic-adaptive-blinding-deep).
`.trim()
  },

  // ── Library & decks ─────────────────────────────────────────────────────
  {
    id: "library",
    group: "library",
    title: "The Library",
    markdown: `
# The Library

Your home screen. It shows your decks with **card count** and **due count**, and lets you start reviews.

**Filtering** (above the deck list):
- **Search** — full-text match against card title and content; debounced 200 ms.
- **Tags** — multi-select chips; AND-combine multiple tags.
- **Type** — drop-down to limit to Standard / Text / Cloze.

When filters are active, decks expand to show matching cards. Click a card to edit it; click **Review** on a deck to start a session limited to that deck.
`.trim()
  },
  {
    id: "deck-management",
    group: "library",
    title: "Decks",
    markdown: `
# Decks

Decks are the only required grouping — every card belongs to one.

- Create a deck by choosing **+ New Deck…** in the editor's *Deck* dropdown.
- Move a card by editing it and changing its deck.
- Deleting a card is a **soft delete** — it leaves a tombstone so other devices can sync the removal. The card is gone from the UI immediately.
- Deleting a standard card that has a **reverse companion** also offers to delete the companion.
- Deck deletion is not yet available — to "delete" a deck, move its cards out then leave it empty.
`.trim()
  },
  {
    id: "unsaved-changes",
    group: "library",
    title: "Unsaved-changes guard",
    markdown: `
# Unsaved-changes guard

The editor tracks whether you've modified the form (\`isDirty\`). If you click **← Back** with unsaved edits, you'll get a *Discard unsaved changes?* confirm.

The same guard fires for **Help**, **Settings**, and any nav button while editing.

If you switch **card type** in the editor and have content already, you'll get a separate *Switching card type will clear the current content. Continue?* confirm.
`.trim()
  },

  // ── Stats ───────────────────────────────────────────────────────────────
  {
    id: "stats",
    group: "stats",
    title: "Stats dashboard",
    markdown: `
# Stats dashboard

Filter by card type with the segmented buttons (**All / Standard / Text / Cloze**). The KPIs and charts update in place.

**KPIs**
- **Current streak** — consecutive days with at least one review.
- **Total reviews** — count for the current filter.
- **Total review time** — sum of interaction time across all reviews.
- **Sessions** (or **Active type** when filtered) — total sessions started.

**Charts**
- **Reviews — last 30 days** — daily review count.
- **Mastery distribution** — how many cards sit in each 0–25 / 25–50 / 50–75 / 75–100 % bucket.
- **Due in the next 7 days** — your incoming workload.
- **Ratings — last 30 days** — Again / Hard / Good / Easy / Perfect breakdown.
`.trim()
  },

  // ── Import & backup ─────────────────────────────────────────────────────
  {
    id: "import",
    group: "import-backup",
    title: "Importing cards",
    markdown: `
# Importing cards

From **Import → Import Cards or Deck**, choose a file. The app auto-detects the format from the contents and extension.

Supported:
- \`.md\` — markdown deck format ([details](#topic-md-deck-format)).
- \`.txt\` — single plain-text card (text memorization).
- \`.json\` — structured card array (use the export format as a reference).

Markdown imports always start as **new cards** with fresh schedules. If you want to migrate cards between devices with mastery intact, use a **snapshot** instead (Backup → Export Snapshot).

Cards with the same fingerprint as existing cards are **skipped** as duplicates — you'll see the count in the import preview.
`.trim()
  },
  {
    id: "md-deck-format",
    group: "import-backup",
    title: "Markdown deck format",
    markdown: `
# Markdown deck format

A minimal deck file:

\`\`\`markdown
# Deck title (optional)

## First card title
Front side markdown.

---

Back side markdown.

## Second card title
Front.

---

Back.
\`\`\`

Rules:
- The top-level \`# heading\` becomes the **deck name** (file name is used if missing).
- Each \`## heading\` starts a new card; the heading text is the card title.
- Inside a card, \`---\` on its own line separates sides. Use multiple to get 3+ sides.
- Card content is full markdown — math, code blocks, images, etc.

Tags, schedules, and other metadata aren't expressible here. Use **JSON** or **snapshot** import if you need them.
`.trim()
  },
  {
    id: "backup-and-sync",
    group: "import-backup",
    title: "Backup & restore",
    markdown: `
# Backup & restore

**Backup → Export Snapshot** produces a JSON file containing all your cards, decks, reviews, sessions, settings, and (if enabled) encryption metadata.

- On desktop, the file downloads to your downloads folder.
- On mobile, the Web Share API lets you save it to iCloud Drive, Google Drive, Files, etc.

**Restore** (Import → Restore from Snapshot) is **replace-all**:
1. The app first **downloads your current data** as an "emergency" backup — automatic safety net.
2. Then it wipes IndexedDB and replays the snapshot.

⚠️ Snapshot files are **not encrypted** even if your vault is. Anyone who opens the file can read all your cards. Treat snapshots like personal data.

There's no merge mode yet. To move data between two active devices without losing progress, **pick one** as canonical and replace from there.
`.trim()
  },

  // ── Sync folder ─────────────────────────────────────────────────────────
  {
    id: "sync-folder",
    group: "sync-folder",
    title: "Sync folder (Chromium)",
    markdown: `
# Sync folder

**Chromium-only feature** (Chrome, Edge, Arc, Brave). On Firefox and Safari this section is hidden.

**Backup → Connect Sync Folder** asks you to pick a folder on disk. Once connected:

- Every snapshot you export is **also written to that folder** automatically. File names include a timestamp.
- The **Import** screen lists snapshots in that folder for one-tap restore.
- The connection persists across reloads. If permission was revoked (e.g., after a browser restart), the next export prompts to re-authorize.

Common pairings:
- Point both devices at the same iCloud / Google Drive / Dropbox folder. Export on device A → device B sees the snapshot in *Import → From Sync Folder*.

The app never reads or writes the folder without an explicit user action (export, list, restore).
`.trim()
  },

  // ── Settings & encryption ───────────────────────────────────────────────
  {
    id: "settings",
    group: "settings",
    title: "Settings",
    markdown: `
# Settings

| Setting | What it does |
|---|---|
| **Daily Review Limit** | Max cards per session (default 30). |
| **New Cards per Session** | How many never-seen cards are introduced (default 5). |
| **Theme** | System / Light / Dark. |
| **Math rendering** | Toggle KaTeX. Off = \`$x$\` renders literally. |
| **Backup reminder** | Opt-in nudge when you haven't exported in a while. |

The **About** section shows the current version and re-opens the changelog.

For encryption see the *Encryption* topic below.
`.trim()
  },
  {
    id: "encryption",
    group: "settings",
    title: "Encryption",
    markdown: `
# Encryption

Optional **at-rest encryption** for your card data.

**What's encrypted**
- Card content (sides, text-memory text, cloze text), title, tags.
- Deck names.

**What's NOT encrypted**
- Review history, ratings, schedule timestamps.
- Stats (counts, durations, streaks).
- Snapshots — the export is plain JSON. Don't share it.

**Setup**
1. Settings → **Enable Encryption**.
2. Pick a password. The key is derived locally; the password itself is never stored.
3. Existing cards and deck names are encrypted in place.

**Each app launch** asks for the password to unlock the vault. If you cancel, the app stays locked — cards aren't visible until you reload and unlock.

**Change Password** decrypts everything, derives a new key, re-encrypts. **Disable Encryption** decrypts everything back to plain.

There's **no recovery** if you forget the password. Keep an unencrypted snapshot somewhere safe as a fallback.
`.trim()
  },
  {
    id: "pwa-install",
    group: "settings",
    title: "Install as an app (PWA)",
    markdown: `
# Install as an app

The app is a Progressive Web App. Once installed it:

- Opens in its own window with no browser chrome.
- Runs **fully offline** — all code, vendor libraries, and styles are precached by the service worker.
- Updates automatically when you reload after a deploy.

**How to install**
- **Desktop Chrome / Edge** — install icon in the address bar.
- **iOS Safari** — Share → *Add to Home Screen*.
- **Android Chrome** — menu → *Install app*.

The Library shows a one-time install hint on mobile if no install is detected.
`.trim()
  },

  // ── How it works (algorithms) ───────────────────────────────────────────
  {
    id: "sr-algorithm",
    group: "how-it-works",
    title: "How spaced repetition works",
    markdown: `
# How spaced repetition works

The scheduler is an SM-2 variant. Each card carries two key numbers:

- **interval** — days until next review.
- **ease** — multiplier (starts at **2.5**, floor **1.3**).

On each rating, both update:

| Rating | New interval | Ease change |
|---|---|---|
| **Again** | \`0.25\` days (≈ 6h) | − 0.3 |
| **Hard** | \`interval × 1.2\` (min 1) | − 0.15 |
| **Good** | \`interval × ease\` (min 1) | unchanged |
| **Easy** | \`interval × ease × 1.4\` (min 3) | + 0.1 |
| **Perfect** | \`interval × ease × 1.8\` (min 7) | + 0.15 |

\`nextDueAt = now + interval days\`. Ease is clamped to a 1.3 floor so badly-rated cards never grow uncatchably fast.

**Queue priority** combines: is-due, days overdue, never-reviewed bonus, recently-failed bonus, and \`(1 − mastery) × 20\` so weaker cards float up.
`.trim()
  },
  {
    id: "adaptive-blinding-deep",
    group: "how-it-works",
    title: "Adaptive blinding internals",
    markdown: `
# Adaptive blinding internals

For text-memory cards the passage is tokenized into words + separators. Each **word token** carries its own mini-stats: \`seenCount\`, \`correctCount\`, \`mastery\` (0..1).

**During recall**, the app picks a blinding mode per word:
- High mastery → visible or first-letter hint.
- Low mastery → fully blinded.

You can override the choice (**K** keep, **E** easier, **H** harder, **C** customize) before rating. Customize lets you paint individual words with a chosen state or bulk-set all words.

**On rating**, per-word mastery shifts based on which words were revealed/missed and the overall rating. Whole-card mastery is the **average across all word tokens**.

Punctuation, whitespace, and short stop-tokens never get blinded — they're skipped by the tokenizer's "blindable?" check.
`.trim()
  },
  {
    id: "cloze-grouping",
    group: "how-it-works",
    title: "Cloze grouping & aggregate mastery",
    markdown: `
# Cloze grouping & aggregate mastery

Each \`{{cN::…}}\` group is parsed into a unique key (\`c1\`, \`c2\`, …). The card stores:

- A \`groupStats\` map: \`{ c1: { ease, interval, mastery, … }, c2: { … } }\`.
- An **aggregate** \`cardStats\` on the card itself, refreshed after edits.

When you review a cloze card, the scheduler **rates a single group at a time**. The other groups are unaffected. The card's aggregate mastery is the average across all groups — so a card with one weak group still surfaces in due/failed queues.

Editing the source text:
- Unchanged group keys keep their stats.
- New keys start fresh.
- Removed keys are dropped.
`.trim()
  },

  // ── Data & storage ──────────────────────────────────────────────────────
  {
    id: "data-model",
    group: "data",
    title: "Data model",
    markdown: `
# Data model

Everything lives in **IndexedDB** under one database, with seven object stores:

| Store | Purpose |
|---|---|
| \`cards\` | All cards, soft-deleted with \`deletedAt\`. |
| \`decks\` | Deck metadata. |
| \`reviews\` | One row per rated card. The source of truth for stats. |
| \`sessions\` | One row per review session (start, end, results). |
| \`settings\` | Single \`global\` row — preferences + encryption metadata. |
| \`deletedRecords\` | Tombstones for soft-deleted rows, for future sync. |
| \`syncLog\` | Import/export event log shown in Backup screen. |

Every row carries a **device-scoped ID** (random + per-device prefix) so multiple devices won't collide if sync arrives later.
`.trim()
  },
  {
    id: "snapshot-format",
    group: "data",
    title: "Snapshot format",
    markdown: `
# Snapshot format

A snapshot is a JSON file with a versioned envelope:

\`\`\`json
{
  "snapshotVersion": 1,
  "snapshotId": "snap_…",
  "createdAt": "2026-…",
  "deviceId": "dev_…",
  "appVersion": "1.1.0",
  "cards": [...],
  "decks": [...],
  "reviews": [...],
  "sessions": [...],
  "settings": {...},
  "deletedRecords": [...],
  "syncLog": [...]
}
\`\`\`

- Encrypted cards are exported in their encrypted form — the snapshot preserves whatever was in IndexedDB, including encryption salt / verify envelope.
- Restoring uses **replace-all** semantics; no field-by-field merge.
- The schema can grow forward-compatibly — older snapshots restore on newer app versions as long as \`snapshotVersion\` is recognized.
`.trim()
  },
  {
    id: "privacy",
    group: "data",
    title: "Privacy",
    markdown: `
# Privacy

- The app **makes no network calls** after the initial load (and service worker precache).
- No analytics, no telemetry, no error reporting.
- Your cards, decks, reviews, and audio never leave the device unless **you** export a snapshot or share a clip.
- The sync folder is a local OS folder you pick — the app uses the browser's File System Access API to read/write that folder only when you trigger it.

If you want extra at-rest protection, enable [encryption](#topic-encryption).
`.trim()
  },

  // ── Reference ───────────────────────────────────────────────────────────
  {
    id: "keyboard-all",
    group: "reference",
    title: "Full keyboard reference",
    markdown: `
# Full keyboard reference

**Review (any card type)**

| Key | Action |
|---|---|
| Space | Reveal next side / answer |
| 1 / 2 / 3 / 4 / 5 | Again / Hard / Good / Easy / Perfect |

**Text memorization**

| Key | Action | When |
|---|---|---|
| P | Peek full text (toggle) | During recall |
| K | Keep current blinding | Between reveal and rating |
| E | Easier | Between reveal and rating |
| H | Harder | Between reveal and rating |
| C | Customize | Between reveal and rating |
| F / L / B | Brush: Full / Letter / Blind | While customizing |

**Modals**

| Key | Action |
|---|---|
| Esc / click outside | Close (cancels) |
| Enter | Submit (in password modals) |
`.trim()
  },
  {
    id: "changelog",
    group: "reference",
    title: "Changelog",
    markdown: `
# Changelog

The "What's new" modal appears once after each upgrade, listing changes since your last seen version.

You can re-open it any time from **Settings → About → View changelog**.

The current app version is shown next to "About" in Settings.
`.trim()
  }
];

const HELP_TOPICS_BY_ID = Object.fromEntries(HELP_TOPICS.map(t => [t.id, t]));
