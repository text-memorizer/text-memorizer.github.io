function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore(db, storeName) {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return reqToPromise(store.getAll());
}

async function getFromStore(db, storeName, key) {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return reqToPromise(store.get(key));
}

async function putRecord(db, storeName, record) {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await reqToPromise(store.put(record));
  await txDone(tx);
}

async function putRecords(db, storeName, records) {
  if (!records.length) return;
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const r of records) store.put(r);
  await txDone(tx);
}

async function deleteRecord(db, storeName, key) {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await reqToPromise(store.delete(key));
  await txDone(tx);
}

async function clearStore(db, storeName) {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await reqToPromise(store.clear());
  await txDone(tx);
}

async function getByIndex(db, storeName, indexName, value) {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const index = store.index(indexName);
  return reqToPromise(index.getAll(value));
}

async function getOneByIndex(db, storeName, indexName, value) {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const index = store.index(indexName);
  return reqToPromise(index.get(value));
}

// Typed helpers
const repo = {
  getAllDecks: (db) => getAllFromStore(db, "decks"),
  getDeck: (db, id) => getFromStore(db, "decks", id),
  putDeck: (db, deck) => putRecord(db, "decks", deck),
  deleteDeck: (db, id) => deleteRecord(db, "decks", id),

  getAllCards: (db) => getAllFromStore(db, "cards"),
  getCard: (db, id) => getFromStore(db, "cards", id),
  putCard: (db, card) => putRecord(db, "cards", card),
  putCards: (db, cards) => putRecords(db, "cards", cards),
  deleteCard: (db, id) => deleteRecord(db, "cards", id),
  getCardsByDeck: (db, deckId) => getByIndex(db, "cards", "deckId", deckId),
  getCardByFingerprint: (db, fp) => getOneByIndex(db, "cards", "fingerprint", fp),

  getAllReviews: (db) => getAllFromStore(db, "reviews"),
  putReview: (db, review) => putRecord(db, "reviews", review),
  getReviewsByCard: (db, cardId) => getByIndex(db, "reviews", "cardId", cardId),

  getAllSessions: (db) => getAllFromStore(db, "sessions"),
  getSession: (db, id) => getFromStore(db, "sessions", id),
  putSession: (db, session) => putRecord(db, "sessions", session),

  getSettings: (db) => getFromStore(db, "settings", "global"),
  putSettings: (db, settings) => putRecord(db, "settings", settings),

  getAllDeletedRecords: (db) => getAllFromStore(db, "deletedRecords"),
  putDeletedRecord: (db, rec) => putRecord(db, "deletedRecords", rec),

  getAllSyncLog: (db) => getAllFromStore(db, "syncLog"),
  putSyncLog: (db, entry) => putRecord(db, "syncLog", entry)
};
