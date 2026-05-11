# Technical Blueprint: Offline-First Memorization Flashcard Website

## 1. Product Summary

This project is an offline-first web application for memorizing text and reviewing standard flashcards. It runs as a browser-based HTML app and stores user data locally in IndexedDB. Users can import card/deck files from local storage or Google Drive through the device file picker, export full IndexedDB snapshots, save those snapshots to Google Drive, and restore or transfer progress on another device without requiring a server.

The app supports two primary card types:

1. **Text memorization cards**  
   Cards that progressively remove hints from a passage. The first review shows the first letter of each word. The user can click letters or blanks to reveal words, then reveal the full text, grade recall, and decide which words should be blinded next time.

2. **Standard markdown flashcards**  
   Front/back cards that support Markdown and LaTeX-style math equations. These are reviewed like standard flashcards: show front, reveal back, grade recall.

The app also supports two major file workflows:

1. **Card/deck import files**  
   Human-authored `.txt`, `.md`, `.csv`, `.tsv`, or `.json` files that add cards and decks.

2. **Snapshot files**  
   Full app backup files that capture the IndexedDB state, including cards, decks, review history, sessions, settings, sync metadata, and deleted records.

---

## 2. Goals

### 2.1 Core Goals

- Run as a static website or single-page app.
- Work offline after initial load.
- Store all app data in IndexedDB.
- Support progressive text memorization cards.
- Support standard front/back flashcards.
- Render Markdown and LaTeX-style math safely.
- Allow users to import decks/cards from text files.
- Allow users to export and restore full app snapshots.
- Support multi-device use without a server through manual snapshot export/import.
- Support mobile-friendly import/export using the phone file picker and share sheet.

### 2.2 Non-Goals for the MVP

- Real-time automatic cloud sync.
- Server accounts.
- Google Drive OAuth integration.
- Collaborative editing.
- Media-heavy cards.
- Native mobile app packaging.
- Full Anki compatibility.

---

## 3. Recommended Technology Stack

### 3.1 App Type

Recommended MVP:

- Static HTML, CSS, and JavaScript.
- Optional progressive web app manifest and service worker.
- No backend server.

Recommended later version:

- TypeScript.
- Vite or similar local build tooling.
- Modular source files bundled into static assets.
- Optional PWA installation support.

### 3.2 Browser APIs

Required:

- IndexedDB for local persistent data.
- File input for importing decks and snapshots.
- Blob/File APIs for generating export files.
- URL.createObjectURL for download fallback.

Recommended:

- Web Share API for mobile snapshot export.
- Service Worker for offline app shell caching.
- Web Crypto API for hashing and optional encrypted backups.

### 3.3 Libraries

For Markdown and math rendering:

- `marked` or `markdown-it` for Markdown parsing.
- `DOMPurify` for HTML sanitization.
- `KaTeX` for LaTeX-style math rendering.

Recommended MVP combination:

- `marked`
- `DOMPurify`
- `KaTeX`
- `KaTeX auto-render`

These can be loaded from local `vendor/` files so the app remains offline-capable.

---

## 4. Application Architecture

### 4.1 High-Level Modules

```text
/src
  app.js
  router.js
  state.js

  /db
    db.js
    schema.js
    migrations.js
    repositories.js

  /cards
    cards.js
    standardCard.js
    textMemoryCard.js
    tokenizer.js
    fingerprints.js

  /review
    reviewController.js
    standardReview.js
    textMemoryReview.js
    scheduler.js
    adaptiveBlinding.js

  /render
    markdownRenderer.js
    standardRenderer.js
    textMemoryRenderer.js
    progressRenderer.js

  /import
    importController.js
    detectImportKind.js

    /cards
      parseMarkdownDeck.js
      parsePlainTextCard.js
      parseCsvCards.js
      parseJsonCards.js
      validateImportedCards.js
      saveImportedCards.js

    /snapshot
      parseSnapshot.js
      validateSnapshot.js
      previewSnapshot.js
      restoreSnapshot.js
      mergeSnapshot.js

  /export
    snapshotExport.js
    snapshotShare.js
    backupFile.js

  /ui
    libraryScreen.js
    editorScreen.js
    reviewScreen.js
    importScreen.js
    exportScreen.js
    settingsScreen.js
    components.js

  /utils
    ids.js
    time.js
    hash.js
    text.js
    events.js
```

### 4.2 Architectural Rule

Keep these responsibilities separate:

```text
Original card content
Review metadata
Session metadata
Scheduling metadata
Import/export metadata
```

The app should never mutate the original text destructively. It should update metadata such as word visibility, mastery, review history, and due dates.

---

## 5. Core Screens

### 5.1 Home / Library Screen

Purpose: browse and manage study material.

Features:

- List decks.
- List cards.
- Filter by deck, card type, due status, tags, and difficulty.
- Show card counts and due counts.
- Start review session.
- Add card.
- Import cards/deck.
- Export or restore snapshot.

Suggested card list columns:

```text
Title
Type
Deck
Due
Mastery
Reviews
Last Seen
```

### 5.2 Card Editor Screen

The editor supports card type selection.

Card types:

```text
Standard flashcard
Text memorization card
```

Standard flashcard fields:

```text
Title
Deck
Tags
Front Markdown
Back Markdown
Live Preview
```

Text memorization fields:

```text
Title
Deck
Tags
Text
Initial display mode
Token preview
```

### 5.3 Review Session Screen

Common review controls:

```text
Show answer / Show full text
Again
Hard
Good
Easy
Perfect
Skip
End session
```

Text memorization controls:

```text
Click word/letter/blank to reveal word
Show full text
Make easier
Keep same
Make harder
Customize words
Accept suggested blinding
```

Standard card controls:

```text
Show front
Reveal back
Rate recall
```

### 5.4 Import Screen

Two visible entry points:

```text
Import Cards or Deck
Restore from Snapshot
```

Both can use the same file picker internally. The app detects the selected file and routes it to the correct importer.

### 5.5 Backup and Transfer Screen

Features:

```text
Export Snapshot
Import Snapshot
Last exported
Last imported
Explain manual Google Drive workflow
```

---

## 6. IndexedDB Design

### 6.1 Database Name

```text
memorizationApp
```

### 6.2 Object Stores

```text
cards
reviews
sessions
decks
settings
deletedRecords
syncLog
```

### 6.3 Store: decks

```js
{
  id: "deck_01HV...",
  name: "Algebra Basics",
  description: "",
  tags: ["math", "algebra"],
  createdAt: "2026-05-11T20:30:00.000Z",
  updatedAt: "2026-05-11T20:30:00.000Z",
  deletedAt: null,
  modifiedByDeviceId: "device_abc",
  revision: 1
}
```

Indexes:

```text
name
updatedAt
deletedAt
```

### 6.4 Store: cards

Shared card fields:

```js
{
  id: "card_01HV...",
  type: "standard" | "text-memory",
  title: "Quadratic Formula",
  deckId: "deck_01HV...",
  tags: ["math", "equation"],
  fingerprint: "sha256_...",

  standardCard: null,
  textMemoryCard: null,

  cardStats: {
    totalReviews: 0,
    successfulReviews: 0,
    failedReviews: 0,
    lastSeenAt: null,
    nextDueAt: "2026-05-11T20:30:00.000Z",
    intervalDays: 0,
    ease: 2.5,
    masteryPercent: 0,
    failedRecently: false
  },

  createdAt: "2026-05-11T20:30:00.000Z",
  updatedAt: "2026-05-11T20:30:00.000Z",
  deletedAt: null,
  modifiedByDeviceId: "device_abc",
  revision: 1
}
```

Indexes:

```text
type
deckId
nextDueAt
updatedAt
fingerprint
masteryPercent
deletedAt
```

### 6.5 Standard Card Payload

```js
standardCard: {
  frontMarkdown: "What is the quadratic formula?",
  backMarkdown: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$"
}
```

### 6.6 Text Memory Card Payload

```js
textMemoryCard: {
  text: "Four score and seven years ago...",
  preserveLineBreaks: true,
  tokens: [
    {
      type: "word",
      index: 0,
      raw: "Four",
      normalized: "four",
      prefix: "F",
      visibleMode: "letter",
      mastery: 0,
      revealCount: 0,
      rightCount: 0,
      wrongCount: 0,
      lastClickedAt: null,
      lastChangedAt: null
    },
    {
      type: "space",
      raw: " "
    },
    {
      type: "word",
      index: 1,
      raw: "score",
      normalized: "score",
      prefix: "s",
      visibleMode: "letter",
      mastery: 0,
      revealCount: 0,
      rightCount: 0,
      wrongCount: 0,
      lastClickedAt: null,
      lastChangedAt: null
    }
  ]
}
```

Valid word `visibleMode` values:

```text
full
letter
blind
locked
```

### 6.7 Store: reviews

```js
{
  id: "review_01HV...",
  cardId: "card_01HV...",
  cardType: "standard" | "text-memory",
  sessionId: "session_01HV...",
  reviewedAt: "2026-05-11T20:30:00.000Z",
  userRating: "again" | "hard" | "good" | "easy" | "perfect",

  interactionStats: {
    timeToRevealMs: 12000,
    timeAfterRevealMs: 8000,
    totalTimeMs: 20000,
    revealFullTextUsed: true,
    wordsClicked: [2, 7, 8]
  },

  displayBeforeReview: {
    visibleWordCount: 20,
    blindedWordCount: 8,
    fullWordCount: 0,
    letterWordCount: 20
  },

  userDecision: {
    blindMore: [0, 1, 3],
    unblind: [7, 8],
    keepSame: [2, 4, 5],
    acceptedSuggestion: true
  },

  result: {
    previousIntervalDays: 1,
    newIntervalDays: 3,
    previousNextDueAt: "2026-05-10T20:30:00.000Z",
    nextDueAt: "2026-05-14T20:30:00.000Z",
    masteryDelta: 0.08
  },

  createdAt: "2026-05-11T20:30:00.000Z",
  modifiedByDeviceId: "device_abc"
}
```

Indexes:

```text
cardId
sessionId
reviewedAt
cardType
```

### 6.8 Store: sessions

```js
{
  id: "session_01HV...",
  startedAt: "2026-05-11T20:00:00.000Z",
  endedAt: null,
  deckId: "deck_01HV...",
  targetCardCount: 20,
  cardsReviewed: ["card_01HV..."],
  reviewQueue: ["card_01HV...", "card_02HV..."],
  settings: {
    includeNew: true,
    includeDue: true,
    includeDifficult: true,
    maxNewCards: 5,
    repeatFailedCards: true
  },
  createdAt: "2026-05-11T20:00:00.000Z",
  updatedAt: "2026-05-11T20:30:00.000Z",
  modifiedByDeviceId: "device_abc"
}
```

Indexes:

```text
startedAt
endedAt
deckId
```

### 6.9 Store: settings

```js
{
  id: "global",
  dailyReviewLimit: 30,
  defaultNewCardsPerSession: 5,
  schedulingAlgorithm: "adaptive-spaced-repetition",
  theme: "system",
  markdownMathEnabled: true,
  backupReminderEnabled: true,
  createdAt: "2026-05-11T20:00:00.000Z",
  updatedAt: "2026-05-11T20:30:00.000Z"
}
```

### 6.10 Store: deletedRecords

Used for future merge support.

```js
{
  id: "deleted_card_01HV...",
  recordId: "card_01HV...",
  storeName: "cards",
  deletedAt: "2026-05-11T20:30:00.000Z",
  deletedByDeviceId: "device_abc"
}
```

### 6.11 Store: syncLog

```js
{
  id: "sync_01HV...",
  type: "export" | "import",
  snapshotId: "snap_01HV...",
  fileName: "memorizer-snapshot-2026-05-11T20-30-00.json",
  happenedAt: "2026-05-11T20:30:00.000Z",
  deviceId: "device_abc",
  result: "success" | "failed",
  message: ""
}
```

---

## 7. Text Memorization Card Design

### 7.1 Tokenization

The tokenizer should preserve words, spaces, punctuation, and line breaks.

Example input:

```text
To be, or not to be.
```

Tokenized representation:

```js
[
  { type: "word", raw: "To", prefix: "T" },
  { type: "space", raw: " " },
  { type: "word", raw: "be", prefix: "b" },
  { type: "punctuation", raw: "," },
  { type: "space", raw: " " },
  { type: "word", raw: "or", prefix: "o" },
  { type: "space", raw: " " },
  { type: "word", raw: "not", prefix: "n" },
  { type: "space", raw: " " },
  { type: "word", raw: "to", prefix: "t" },
  { type: "space", raw: " " },
  { type: "word", raw: "be", prefix: "b" },
  { type: "punctuation", raw: "." }
]
```

### 7.2 Display Modes

For each word token:

```text
full    show the full word
letter  show the first letter
blind   show blank or underscore
locked  always show the full word
```

Examples:

Full:

```text
To be, or not to be.
```

Letter:

```text
T b, o n t b.
```

Partially blind:

```text
T _, o _ t _.
```

Fully blind:

```text
_ _, _ _ _ _.
```

### 7.3 Click-to-Reveal

Each word should be rendered as a clickable element.

Persistent state:

```text
visibleMode
mastery
revealCount
```

Temporary review state:

```text
tempRevealed
clickedThisReview
```

Clicking a word should reveal it for the current review only and record that the user needed help.

### 7.4 Review Flow

```text
1. Render adaptive hint version.
2. User attempts recall.
3. User may click words to reveal temporary help.
4. User clicks Show Full Text.
5. User compares recall.
6. User rates Again / Hard / Good / Easy / Perfect.
7. App suggests next blinding pattern.
8. User accepts, makes easier, makes harder, or customizes.
9. App updates word metadata, card stats, review history, and schedule.
10. App chooses next card.
```

### 7.5 Adaptive Word Mastery

Each word gets a mastery score from `0` to `1`.

Example update logic:

```js
function updateWordMastery(word, rating, wasClicked) {
  const ratingDelta = {
    again: -0.15,
    hard: 0.02,
    good: 0.08,
    easy: 0.14,
    perfect: 0.22
  };

  let delta = ratingDelta[rating];

  if (wasClicked) {
    delta -= 0.18;
    word.revealCount += 1;
    word.lastClickedAt = new Date().toISOString();
  }

  word.mastery = clamp(word.mastery + delta, 0, 1);
}
```

### 7.6 Adaptive Blinding

Promotion path:

```text
full -> letter -> blind
```

Demotion path:

```text
blind -> letter -> full
```

Suggested behavior:

```text
Again: demote clicked or low-mastery words
Hard: keep mostly the same
Good: blind a small number of high-mastery words
Easy: blind more high-mastery words
Perfect: blind many or all remaining hint words
```

Candidate scoring:

```js
function blindCandidateScore(word, context) {
  let score = word.mastery * 100;

  if (word.revealCount > 0) score -= word.revealCount * 20;
  if (word.raw.length <= 3) score += 10;
  if (context.isProperNoun) score -= 15;
  if (context.isFirstWordOfLine) score -= 10;
  if (context.isRepeated) score += 8;

  return score;
}
```

### 7.7 Manual Customization

After showing the full text, allow the user to cycle each word through:

```text
Full word -> First letter -> Blind
```

This lets the app suggest changes while preserving user control.

---

## 8. Standard Markdown Flashcard Design

### 8.1 Content Model

Standard cards have:

```text
frontMarkdown
backMarkdown
```

Both fields support:

- Markdown headings.
- Lists.
- Tables.
- Code blocks.
- Inline math.
- Block math.

### 8.2 Markdown and Math Syntax

Inline math:

```md
The formula is $E = mc^2$.
```

Block math:

```md
$$
E = mc^2
$$
```

### 8.3 Safe Rendering Pipeline

```text
Raw Markdown
-> Markdown parser
-> HTML sanitizer
-> Math renderer
-> DOM insertion
```

Example function:

```js
function renderMarkdown(rawMarkdown) {
  const unsafeHtml = marked.parse(rawMarkdown);

  const safeHtml = DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true }
  });

  const container = document.createElement("div");
  container.innerHTML = safeHtml;

  renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false
  });

  return container;
}
```

### 8.4 Review Flow

```text
1. Show front.
2. User attempts answer.
3. User clicks Show Answer.
4. Show back.
5. User rates Again / Hard / Good / Easy / Perfect.
6. App updates schedule and review history.
7. App chooses next card.
```

---

## 9. Scheduling and Session Selection

### 9.1 Ratings

```text
Again   failed recall
Hard    recalled with significant difficulty
Good    recalled correctly
Easy    recalled comfortably
Perfect instant or near-instant recall
```

### 9.2 Card Scheduling

Simple interval rules for MVP:

```text
Again: 5 minutes or later this session
Hard: 1 day
Good: 3 days
Easy: 7 days
Perfect: 14 days
```

Adaptive interval version:

```js
function updateSchedule(card, rating) {
  const stats = card.cardStats;

  if (rating === "again") {
    stats.intervalDays = 0.25;
    stats.ease = Math.max(1.3, stats.ease - 0.3);
  }

  if (rating === "hard") {
    stats.intervalDays = Math.max(1, stats.intervalDays * 1.2 || 1);
    stats.ease = Math.max(1.3, stats.ease - 0.15);
  }

  if (rating === "good") {
    stats.intervalDays = Math.max(1, stats.intervalDays * stats.ease || 3);
  }

  if (rating === "easy") {
    stats.intervalDays = Math.max(3, stats.intervalDays * stats.ease * 1.4 || 7);
    stats.ease += 0.1;
  }

  if (rating === "perfect") {
    stats.intervalDays = Math.max(7, stats.intervalDays * stats.ease * 1.8 || 14);
    stats.ease += 0.15;
  }

  stats.lastSeenAt = new Date().toISOString();
  stats.nextDueAt = addDays(new Date(), stats.intervalDays).toISOString();
}
```

### 9.3 Session Mix

Default session composition:

```text
70% due cards
20% difficult cards
10% new cards
```

Session settings:

```js
{
  targetCardCount: 20,
  maxNewCards: 5,
  includeDue: true,
  includeDifficult: true,
  includeNew: true,
  repeatFailedCards: true
}
```

### 9.4 Priority Score

```js
function cardPriority(card, now) {
  let score = 0;
  const stats = card.cardStats;

  if (new Date(stats.nextDueAt).getTime() <= now) score += 100;

  const daysOverdue = Math.max(
    0,
    (now - new Date(stats.nextDueAt).getTime()) / DAY_MS
  );

  score += daysOverdue * 8;

  if (stats.totalReviews === 0) score += 40;
  if (stats.failedRecently) score += 30;

  score += (1 - stats.masteryPercent) * 20;

  return score;
}
```

---

## 10. Card and Deck Text File Imports

### 10.1 Supported Card Import File Types

```text
.md
.txt
.csv
.tsv
.json
```

### 10.2 Markdown-Style Deck Format

Example:

```md
# Deck: Algebra Basics
Tags: math, algebra
Type: standard

---

Title: Quadratic Formula
Tags: equations, solving

Front:
What is the quadratic formula?

Back:
For:

$$
ax^2 + bx + c = 0
$$

the solutions are:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

---

Type: text-memory
Title: Gettysburg Opening
Tags: history, speech

Text:
Four score and seven years ago our fathers brought forth on this continent...
```

### 10.3 Markdown Deck Parsing Rules

```text
--- separates cards
FieldName: starts a field
Multi-line fields continue until the next recognized field or separator
Deck-level fields apply to all cards unless overridden
Card-level fields override deck-level fields
Blank lines are preserved inside Front, Back, and Text
```

Recognized fields:

```text
Deck
Type
Title
Tags
Front
Back
Text
Notes
Source
Difficulty
```

### 10.4 Plain Text Shortcut

If a `.txt` file does not match a structured format, treat it as one text memorization card.

Default behavior:

```text
Deck: Imported Texts
Title: first 8 words of the text
Type: text-memory
Text: full file content
```

### 10.5 CSV / TSV Import

Recommended columns:

```csv
type,deck,title,tags,front,back,text
standard,Algebra,Quadratic Formula,"math,equation","What is the formula?","$$x = ...$$",
text-memory,Speeches,Gettysburg Opening,"history,memory",,,"Four score and seven years ago..."
```

Rules:

```text
standard cards require front and back
text-memory cards require text
deck can be specified per row
tags are comma-separated
Markdown and math are allowed in front/back
```

### 10.6 JSON Card Import Format

```json
{
  "version": 1,
  "decks": [
    {
      "name": "Algebra Basics",
      "tags": ["math"]
    }
  ],
  "cards": [
    {
      "type": "standard",
      "deck": "Algebra Basics",
      "title": "Quadratic Formula",
      "tags": ["equation"],
      "frontMarkdown": "What is the quadratic formula?",
      "backMarkdown": "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$"
    },
    {
      "type": "text-memory",
      "deck": "Speeches",
      "title": "Gettysburg Opening",
      "tags": ["history"],
      "text": "Four score and seven years ago..."
    }
  ]
}
```

### 10.7 Card Import Preview

Before saving, show:

```text
Deck name
Cards found
Standard cards
Text-memory cards
Duplicates
Warnings
Errors
Cards to import
Cards to skip
```

### 10.8 Duplicate Detection

Standard card fingerprint:

```js
fingerprint = hash(normalize(frontMarkdown) + "\n---\n" + normalize(backMarkdown));
```

Text-memory fingerprint:

```js
fingerprint = hash(normalize(text));
```

Normalization:

```text
trim whitespace
normalize line endings
collapse repeated whitespace
lowercase for duplicate detection only
preserve original content for storage
```

---

## 11. Snapshot Export and Restore

### 11.1 Purpose

Snapshots are full app backups. They are used to transfer data across devices without a server.

Workflow:

```text
Device A IndexedDB -> snapshot file -> Google Drive -> Device B import -> IndexedDB restore
```

### 11.2 Snapshot File Structure

```json
{
  "snapshotVersion": 1,
  "appName": "Text Memorizer",
  "appSchemaVersion": 3,
  "snapshotId": "snap_01HV...",
  "deviceId": "device_phone_abc",
  "createdAt": "2026-05-11T20:30:00.000Z",
  "source": {
    "userAgent": "...",
    "appBuild": "1.0.0"
  },
  "database": {
    "decks": [],
    "cards": [],
    "reviews": [],
    "sessions": [],
    "settings": [],
    "deletedRecords": [],
    "syncLog": []
  },
  "integrity": {
    "recordCount": 432,
    "contentHash": "sha256_..."
  }
}
```

### 11.3 Export Flow

```text
User taps Export Snapshot
App reads all IndexedDB stores
App creates JSON snapshot
App creates File object
App opens share sheet if supported
Fallback: app downloads JSON file
User saves file to Google Drive
```

### 11.4 Export Implementation

```js
async function exportSnapshot(db) {
  const snapshot = {
    snapshotVersion: 1,
    appName: "Text Memorizer",
    appSchemaVersion: CURRENT_SCHEMA_VERSION,
    snapshotId: crypto.randomUUID(),
    deviceId: await getOrCreateDeviceId(),
    createdAt: new Date().toISOString(),
    database: {}
  };

  for (const storeName of [
    "decks",
    "cards",
    "reviews",
    "sessions",
    "settings",
    "deletedRecords",
    "syncLog"
  ]) {
    snapshot.database[storeName] = await getAllFromStore(db, storeName);
  }

  snapshot.integrity = {
    recordCount: countRecords(snapshot.database),
    contentHash: await hashSnapshot(snapshot.database)
  };

  return snapshot;
}
```

### 11.5 Mobile Share / Download

```js
async function shareSnapshotFile(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: "Memorizer Snapshot",
      text: "Backup snapshot for Text Memorizer",
      files: [file]
    });
    return true;
  }

  return false;
}

function downloadSnapshotFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");

  a.href = url;
  a.download = file.name;
  a.click();

  URL.revokeObjectURL(url);
}
```

### 11.6 Import Snapshot Flow

```text
User taps Restore from Snapshot
User chooses .json file from Google Drive or device
App detects snapshot structure
App validates schema and integrity
App previews contents
User chooses restore mode
App creates emergency pre-restore backup
App restores or merges data
App logs import
```

### 11.7 Restore Modes

MVP mode:

```text
Replace local data
```

Later modes:

```text
Merge with local data
Preview only
```

### 11.8 Replace Restore

```js
async function replaceLocalDatabase(db, snapshot) {
  const stores = [
    "decks",
    "cards",
    "reviews",
    "sessions",
    "settings",
    "deletedRecords",
    "syncLog"
  ];

  const tx = db.transaction(stores, "readwrite");

  for (const storeName of stores) {
    const store = tx.objectStore(storeName);
    await clearStore(store);

    for (const record of snapshot.database[storeName] || []) {
      await putRecord(store, record);
    }
  }

  await txDone(tx);
}
```

### 11.9 Merge Restore

Merge support requires stable IDs, `updatedAt`, `deletedAt`, `revision`, and `modifiedByDeviceId` on records.

Rules:

```text
Reviews: append-only by id
Sessions: append missing by id, newer updatedAt wins for matching records
Cards: newer updatedAt wins
Decks: newer updatedAt wins
Settings: local usually wins, or ask user
Deleted records: deletedAt newer than updatedAt wins
```

Conflict case:

```text
Same card edited on two devices after the last common snapshot
```

MVP can avoid complex conflict UI by recommending one active device at a time.

---

## 12. Unified Import Detection

### 12.1 Import Kinds

```text
snapshot
json-card-import
markdown-deck
plain-text-card
csv-cards
tsv-cards
unknown-json
unsupported
```

### 12.2 Detection Function

```js
function detectImportKind(fileName, text) {
  const name = fileName.toLowerCase();
  const trimmed = text.trim();

  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed);

    if (json.snapshotVersion && json.database) {
      return "snapshot";
    }

    if (json.cards || json.decks) {
      return "json-card-import";
    }

    return "unknown-json";
  }

  if (name.endsWith(".csv")) return "csv-cards";
  if (name.endsWith(".tsv")) return "tsv-cards";

  if (
    text.includes("Front:") ||
    text.includes("Back:") ||
    text.includes("Text:") ||
    text.includes("# Deck:") ||
    text.includes("Deck:")
  ) {
    return "markdown-deck";
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return "plain-text-card";
  }

  return "unsupported";
}
```

### 12.3 Import Controller

```js
async function importFile(file, expectedKind = null) {
  const text = await file.text();
  const kind = detectImportKind(file.name, text);

  if (expectedKind === "cards" && kind === "snapshot") {
    return showWrongImportTypeDialog({
      message: "This file is a full app snapshot, not a card deck.",
      suggestedAction: "Restore from snapshot"
    });
  }

  if (expectedKind === "snapshot" && kind !== "snapshot") {
    return showWrongImportTypeDialog({
      message: "This file contains cards, not a full snapshot.",
      suggestedAction: "Import cards"
    });
  }

  if (kind === "snapshot") {
    return startSnapshotImport(file, text);
  }

  if ([
    "json-card-import",
    "markdown-deck",
    "plain-text-card",
    "csv-cards",
    "tsv-cards"
  ].includes(kind)) {
    return startCardImport(file, text, kind);
  }

  throw new Error("Unsupported file format.");
}
```

---

## 13. Mobile Google Drive Workflow Without Drive API

### 13.1 Import Cards from Google Drive

```text
Import Cards or Deck
-> phone file picker opens
-> user chooses .md/.txt/.csv/.tsv/.json file from Google Drive
-> app reads selected file
-> app previews cards
-> app imports into IndexedDB
```

### 13.2 Restore Snapshot from Google Drive

```text
Restore from Snapshot
-> phone file picker opens
-> user chooses memorizer-snapshot JSON file from Google Drive
-> app previews snapshot
-> user confirms replace or merge
-> app restores IndexedDB
```

### 13.3 Export Snapshot to Google Drive

```text
Export Snapshot
-> app creates snapshot JSON file
-> app opens share sheet or downloads file
-> user chooses Google Drive
-> user saves file to Drive
```

### 13.4 User-Facing Sync Guidance

The app should make this clear:

```text
This app does not sync automatically.
To move between devices:
1. Export a snapshot from the current device.
2. Save it to Google Drive.
3. Open the app on the other device.
4. Restore the snapshot.
```

For MVP, recommend:

```text
Use one active device at a time.
Export before switching devices.
Import before studying on another device.
```

---

## 14. Security and Privacy

### 14.1 Local-First Privacy

All user data is stored locally in the browser unless the user exports a file.

### 14.2 Markdown Safety

Never insert raw parsed Markdown without sanitizing.

Unsafe:

```js
element.innerHTML = marked.parse(markdown);
```

Safe:

```js
const safeHtml = DOMPurify.sanitize(marked.parse(markdown));
element.innerHTML = safeHtml;
```

### 14.3 Snapshot Warning

Plain JSON snapshots are readable by anyone with access to the file.

Show:

```text
This backup file is not encrypted. Anyone who can open it can read your cards and progress.
```

### 14.4 Optional Future Encryption

Future flow:

```text
Export encrypted snapshot
User enters password
App encrypts JSON with Web Crypto
Other device requires same password to restore
```

---

## 15. Offline Support

### 15.1 Service Worker

Cache app shell:

```text
index.html
app JS bundle
CSS
vendor libraries
KaTeX fonts
icons
manifest
```

### 15.2 PWA Manifest

Recommended fields:

```json
{
  "name": "Text Memorizer",
  "short_name": "Memorizer",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111111",
  "icons": []
}
```

### 15.3 Offline Data

Data is stored in IndexedDB. Snapshot files are user-managed.

---

## 16. Error Handling

### 16.1 Import Errors

Possible card import errors:

```text
Unsupported file type
Invalid JSON
Standard card missing Front
Standard card missing Back
Text-memory card missing Text
Unknown card type
Empty card section
Duplicate card
```

### 16.2 Snapshot Errors

Possible snapshot errors:

```text
Invalid snapshot file
Snapshot from newer app version
Missing database section
Integrity hash mismatch
Restore cancelled
IndexedDB write failed
```

### 16.3 Recovery Principles

- Always preview before import.
- Always create emergency backup before destructive restore.
- Keep import errors card-specific when possible.
- Allow importing valid cards while skipping invalid ones.
- Log import/export attempts in `syncLog`.

---

## 17. Keyboard Shortcuts

Review shortcuts:

```text
Space       Show answer / show full text
1           Again
2           Hard
3           Good
4           Easy
5           Perfect
E           Make easier
K           Keep same
H           Make harder
C           Customize words
N           Next card
Esc         Close modal / hide overlay
```

---

## 18. Styling and UX Principles

### 18.1 Mobile First

- Large touch targets.
- Sticky review controls.
- Simple import/export instructions.
- Avoid hover-only interactions.
- Make clicked words easy to tap.
- Use readable line height for memorization text.

### 18.2 Review UI

Text-memory cards should visually distinguish:

```text
letter hints
blind blanks
revealed words
punctuation
line breaks
```

Standard flashcards should have:

```text
clear front/back separation
large Show Answer button
rating buttons visible after reveal
math rendering that fits small screens
```

### 18.3 Import UI

Always show:

```text
what kind of file was detected
what will be imported or restored
whether local data may be replaced
warnings and errors
confirmation button
cancel button
```

---

## 19. Testing Plan

### 19.1 Unit Tests

Test:

```text
tokenizer
markdown deck parser
plain text parser
csv parser
json card parser
snapshot validator
fingerprint generation
scheduler
adaptive blinding
merge logic
```

### 19.2 Integration Tests

Test:

```text
create card -> review card -> schedule updates
import deck -> cards appear in library
export snapshot -> import snapshot -> data matches
replace restore -> old data removed, snapshot data present
merge restore -> missing reviews appended
```

### 19.3 Manual Mobile Tests

Test on:

```text
Android Chrome with Google Drive file picker
iPhone Safari with Files / Google Drive enabled
iPad Safari
Desktop Chrome
Desktop Safari
Desktop Firefox
```

Scenarios:

```text
import .md deck from Google Drive
import plain .txt memorization card from Google Drive
export snapshot using share sheet
export snapshot using download fallback
restore snapshot from Google Drive
review cards offline
go offline and reload app
```

---

## 20. Implementation Roadmap

### Phase 1: Local Core

Build:

```text
IndexedDB setup
Deck CRUD
Card CRUD
Standard card editor
Text-memory card editor
Tokenizer
Basic review screen
Basic scheduler
```

### Phase 2: Text Memorization Behavior

Build:

```text
first-letter display
click-to-reveal words
show full text
rating flow
word mastery
adaptive blinding suggestions
manual word customization
```

### Phase 3: Standard Markdown Cards

Build:

```text
front/back review flow
Markdown rendering
KaTeX math rendering
DOMPurify sanitization
live preview in editor
```

### Phase 4: Card and Deck Imports

Build:

```text
unified import file picker
import kind detection
Markdown-style deck parser
plain text single-card parser
CSV/TSV parser
JSON card import parser
import preview
duplicate detection
save imported cards
```

### Phase 5: Snapshot Export and Restore

Build:

```text
snapshot export from IndexedDB
snapshot JSON file creation
mobile share support
fallback download
snapshot import detection
snapshot preview
replace restore
emergency pre-restore backup
syncLog
```

### Phase 6: Multi-Device Merge

Build:

```text
deviceId
record revisions
updatedAt/deletedAt everywhere
append-only review merge
newer-record-wins card/deck merge
conflict detection
merge preview
```

### Phase 7: Offline/PWA Polish

Build:

```text
service worker
manifest
local vendor files
installable app support
backup reminders
settings screen
progress dashboard
```

### Phase 8: Advanced Features

Potential additions:

```text
encrypted snapshots
compressed snapshots
media attachments
cloze deletion cards
Anki import/export
Google Drive API integration
cloud sync service
shared decks
```

---

## 21. MVP Definition

The first useful MVP should include:

```text
Create decks
Create standard cards
Create text memorization cards
Review both card types
Store all data in IndexedDB
Render Markdown and math for standard cards
Import Markdown-style deck files
Import plain text files as memorization cards
Export full snapshot JSON
Import snapshot JSON with replace restore
Mobile-friendly file picker flow
Download fallback for snapshot export
```

Defer:

```text
snapshot merge
encrypted backups
CSV/TSV imports
service worker
PWA installation
advanced conflict resolution
```

---

## 22. Critical Design Decisions

### 22.1 Use IndexedDB as the Source of Truth

All app state lives in IndexedDB. Imported cards and restored snapshots are normalized into IndexedDB records.

### 22.2 Use Files for Portability, Not Live Sync

Google Drive is used through the mobile file picker and share sheet. The app does not need Drive API access for MVP.

### 22.3 Keep Snapshot Restore Separate from Card Import

Snapshots can replace or merge whole app state. Card files only add or update study material.

### 22.4 Keep Card Type Logic Isolated

Shared systems:

```text
scheduling
sessions
reviews
decks
tags
import/export
```

Type-specific systems:

```text
rendering
interaction behavior
mastery calculation
metadata updates
```

### 22.5 Make Destructive Actions Explicit

Snapshot restore can overwrite local data. It must always require preview and confirmation.

---

## 23. Suggested First Build Sequence

1. Build IndexedDB wrapper and schema.
2. Build deck and card CRUD.
3. Build standard card review without Markdown.
4. Add Markdown and KaTeX rendering.
5. Build text-memory tokenizer and renderer.
6. Add click-to-reveal and full-text reveal.
7. Add review ratings and scheduling.
8. Add adaptive blinding.
9. Add Markdown-style deck import.
10. Add plain text import as single memorization card.
11. Add snapshot export.
12. Add snapshot import with replace restore.
13. Add mobile share/download fallback.
14. Add backup/restore warnings and emergency backup.
15. Add polish, filters, progress, and settings.

---

## 24. Example User Workflows

### 24.1 Create and Review a Text Memorization Card

```text
User creates card with full passage
App tokenizes passage
App shows first letters
User attempts recall
User clicks hard words
User reveals full text
User rates Good
App blinds several mastered words
App schedules card for future review
```

### 24.2 Import a Deck from Google Drive on Phone

```text
User taps Import Cards or Deck
File picker opens
User selects Algebra.md from Google Drive
App detects markdown deck file
App previews cards
User confirms import
App saves deck and cards into IndexedDB
```

### 24.3 Transfer to Another Device

```text
On phone:
  User taps Export Snapshot
  App creates JSON file
  User saves file to Google Drive

On laptop:
  User opens app
  User taps Restore from Snapshot
  User chooses JSON file from Google Drive
  App previews snapshot
  User confirms replace restore
  App restores cards, decks, progress, sessions, and settings
```

---

## 25. Final Architecture Summary

The app is an offline-first memorization system with local IndexedDB persistence, two card types, adaptive text blinding, Markdown/LaTeX flashcards, human-friendly deck imports, and serverless multi-device transfer through snapshot files.

The most important implementation boundary is this:

```text
Card/deck files add study material.
Snapshot files restore app state.
```

The most important user boundary is this:

```text
The app does not sync automatically.
The user transfers state by exporting and importing snapshot files.
```

This keeps the first version simple, private, portable, and buildable as a static website.
