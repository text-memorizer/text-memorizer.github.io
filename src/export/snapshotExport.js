async function exportSnapshot(db) {
  const snapshot = {
    snapshotVersion: 1,
    appName: "Text Memorizer",
    appSchemaVersion: CURRENT_SCHEMA_VERSION,
    snapshotId: generateId("snap"),
    deviceId: getOrCreateDeviceId(),
    createdAt: new Date().toISOString(),
    source: {
      userAgent: navigator.userAgent,
      appBuild: "1.0.0"
    },
    database: {}
  };

  for (const storeName of ALL_STORE_NAMES) {
    snapshot.database[storeName] = await getAllFromStore(db, storeName);
  }

  const recordCount = Object.values(snapshot.database).reduce((sum, arr) => sum + arr.length, 0);
  const databaseJson = JSON.stringify(snapshot.database);
  const contentHash = await sha256(databaseJson);

  snapshot.integrity = { recordCount, contentHash };

  return snapshot;
}
