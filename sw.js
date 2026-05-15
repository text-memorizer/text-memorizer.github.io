const CACHE_NAME = "flash-v3";

const FILES_TO_CACHE = [
  ".",
  "manifest.json",
  "style.css",
  "vendor/katex.min.css",
  "vendor/marked.min.js",
  "vendor/purify.min.js",
  "vendor/katex.min.js",
  "vendor/auto-render.min.js",
  "src/utils/ids.js",
  "src/utils/time.js",
  "src/utils/hash.js",
  "src/utils/text.js",
  "src/utils/events.js",
  "src/utils/crypto.js",
  "src/utils/audio.js",
  "src/db/schema.js",
  "src/db/db.js",
  "src/db/repositories.js",
  "src/utils/folderSync.js",
  "src/cards/tokenizer.js",
  "src/cards/clozeParser.js",
  "src/cards/fingerprints.js",
  "src/cards/cards.js",
  "src/review/scheduler.js",
  "src/review/adaptiveBlinding.js",
  "src/review/standardReview.js",
  "src/review/textMemoryReview.js",
  "src/review/clozeReview.js",
  "src/review/reviewController.js",
  "src/render/markdownRenderer.js",
  "src/render/standardRenderer.js",
  "src/render/textMemoryRenderer.js",
  "src/render/clozeRenderer.js",
  "src/render/progressRenderer.js",
  "src/import/detectImportKind.js",
  "src/import/cards/parseMarkdownDeck.js",
  "src/import/cards/parsePlainTextCard.js",
  "src/import/cards/parseJsonCards.js",
  "src/import/cards/validateImportedCards.js",
  "src/import/cards/saveImportedCards.js",
  "src/import/snapshot/parseSnapshot.js",
  "src/import/snapshot/validateSnapshot.js",
  "src/import/snapshot/previewSnapshot.js",
  "src/import/snapshot/restoreSnapshot.js",
  "src/export/snapshotExport.js",
  "src/export/backupFile.js",
  "src/export/snapshotShare.js",
  "src/state.js",
  "src/ui/components.js",
  "src/ui/libraryScreen.js",
  "src/ui/editorScreen.js",
  "src/ui/reviewScreen.js",
  "src/ui/importScreen.js",
  "src/ui/exportScreen.js",
  "src/ui/settingsScreen.js",
  "src/ui/statsScreen.js",
  "src/ui/changelogModal.js",
  "src/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        return response;
      });
    })
  );
});
