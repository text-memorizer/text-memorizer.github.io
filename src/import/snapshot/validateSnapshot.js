async function validateSnapshot(snapshot) {
  if (snapshot.appSchemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `This snapshot was created by a newer version of the app (schema v${snapshot.appSchemaVersion}). ` +
      `Please update the app before restoring.`
    );
  }

  if (snapshot.integrity && snapshot.integrity.contentHash) {
    const actualHash = await sha256(JSON.stringify(snapshot.database));
    if (actualHash !== snapshot.integrity.contentHash) {
      throw new Error("Snapshot integrity check failed: the file may be corrupted.");
    }
  }

  return true;
}
