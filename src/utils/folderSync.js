// File System Access API integration: lets the user pick a folder on disk
// where snapshots are automatically written/listed. Chromium-only; on other
// browsers the picker is unavailable and folderSyncSupported() returns false.

const FOLDER_HANDLE_KEY = "syncFolderHandle";

function folderSyncSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

async function getStoredFolderHandle(db) {
  const rec = await getFromStore(db, "settings", FOLDER_HANDLE_KEY);
  return rec && rec.handle ? rec.handle : null;
}

async function storeFolderHandle(db, handle) {
  await putRecord(db, "settings", { id: FOLDER_HANDLE_KEY, handle });
}

async function clearFolderHandle(db) {
  try { await deleteRecord(db, "settings", FOLDER_HANDLE_KEY); } catch {}
}

async function pickSyncFolder(db) {
  if (!folderSyncSupported()) {
    const err = new Error("Folder sync is not supported in this browser.");
    err.code = "unsupported";
    throw err;
  }
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await storeFolderHandle(db, handle);
  return handle;
}

async function ensureFolderPermission(handle, mode = "readwrite") {
  if (!handle || typeof handle.queryPermission !== "function") return false;
  const current = await handle.queryPermission({ mode });
  if (current === "granted") return true;
  const requested = await handle.requestPermission({ mode });
  return requested === "granted";
}

async function syncFolderAvailable(db) {
  if (!folderSyncSupported()) return false;
  const handle = await getStoredFolderHandle(db);
  if (!handle) return false;
  if (typeof handle.queryPermission !== "function") return false;
  const status = await handle.queryPermission({ mode: "readwrite" });
  return status === "granted";
}

function _snapshotFileName(snapshot) {
  const ts = (snapshot && snapshot.createdAt ? snapshot.createdAt : new Date().toISOString())
    .replace(/[:.]/g, "-");
  return `flash-snapshot-${ts}.json`;
}

async function writeSnapshotToFolder(db, snapshot) {
  const handle = await getStoredFolderHandle(db);
  if (!handle) throw new Error("No sync folder configured.");
  const granted = await ensureFolderPermission(handle, "readwrite");
  if (!granted) throw new Error("Folder permission denied.");

  const fileName = _snapshotFileName(snapshot);
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(snapshot, null, 2));
  await writable.close();
  return fileName;
}

async function listSnapshotsInFolder(db) {
  const handle = await getStoredFolderHandle(db);
  if (!handle) return [];
  const granted = await ensureFolderPermission(handle, "read");
  if (!granted) return [];

  const entries = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== "file") continue;
    if (!name.toLowerCase().endsWith(".json")) continue;
    let size = null;
    let modifiedAt = null;
    try {
      const file = await entry.getFile();
      size = file.size;
      modifiedAt = file.lastModified ? new Date(file.lastModified).toISOString() : null;
    } catch {}
    entries.push({ name, size, modifiedAt });
  }
  entries.sort((a, b) => (b.modifiedAt || "").localeCompare(a.modifiedAt || ""));
  return entries;
}

async function readSnapshotFromFolder(db, name) {
  const handle = await getStoredFolderHandle(db);
  if (!handle) throw new Error("No sync folder configured.");
  const granted = await ensureFolderPermission(handle, "read");
  if (!granted) throw new Error("Folder permission denied.");
  const fileHandle = await handle.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file.text();
}

async function getFolderDisplayName(db) {
  const handle = await getStoredFolderHandle(db);
  return handle ? handle.name : null;
}
