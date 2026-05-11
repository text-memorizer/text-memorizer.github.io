let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, CURRENT_SCHEMA_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      for (const [storeName, config] of Object.entries(STORES)) {
        let store;
        if (!db.objectStoreNames.contains(storeName)) {
          store = db.createObjectStore(storeName, { keyPath: config.keyPath });
        } else {
          store = event.target.transaction.objectStore(storeName);
        }

        for (const idx of config.indexes) {
          if (!store.indexNames.contains(idx.name)) {
            store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
          }
        }
      }
    };

    req.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

function getDB() {
  if (!_db) throw new Error("DB not open. Call openDB() first.");
  return _db;
}
