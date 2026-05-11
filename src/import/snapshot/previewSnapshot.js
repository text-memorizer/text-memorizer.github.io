function previewSnapshot(snapshot) {
  const db = snapshot.database || {};
  return {
    snapshotId: snapshot.snapshotId,
    deviceId: snapshot.deviceId,
    createdAt: snapshot.createdAt,
    appSchemaVersion: snapshot.appSchemaVersion,
    deckCount: (db.decks || []).filter(d => !d.deletedAt).length,
    cardCount: (db.cards || []).filter(c => !c.deletedAt).length,
    reviewCount: (db.reviews || []).length,
    recordCount: snapshot.integrity ? snapshot.integrity.recordCount : "unknown"
  };
}
