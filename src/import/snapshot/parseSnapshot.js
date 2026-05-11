function parseSnapshot(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Invalid snapshot file: not valid JSON.");
  }

  if (!json.snapshotVersion) throw new Error("Invalid snapshot file: missing snapshotVersion.");
  if (!json.database) throw new Error("Invalid snapshot file: missing database section.");

  return json;
}
