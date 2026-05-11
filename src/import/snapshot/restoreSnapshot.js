async function replaceLocalDatabase(db, snapshot) {
  // Always create emergency backup first
  const emergencySnapshot = await exportSnapshot(db);
  const emergencyFile = snapshotToFile(emergencySnapshot);
  downloadFile(emergencyFile);

  // Replace all stores
  const tx = db.transaction(ALL_STORE_NAMES, "readwrite");

  for (const storeName of ALL_STORE_NAMES) {
    const store = tx.objectStore(storeName);
    store.clear();
    for (const record of (snapshot.database[storeName] || [])) {
      store.put(record);
    }
  }

  await txDone(tx);

  // Log the import
  await logSyncEvent(db, "import", snapshot.snapshotId, "success");
}

async function logSyncEvent(db, type, snapshotId, result, message = "") {
  const entry = {
    id: generateId("sync"),
    type,
    snapshotId: snapshotId || null,
    fileName: "",
    happenedAt: new Date().toISOString(),
    deviceId: getOrCreateDeviceId(),
    result,
    message
  };
  await repo.putSyncLog(db, entry);
}
