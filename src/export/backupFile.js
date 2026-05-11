function snapshotToFile(snapshot) {
  const json = JSON.stringify(snapshot, null, 2);
  const ts = snapshot.createdAt.replace(/[:.]/g, "-").replace("T", "T").slice(0, 19);
  const fileName = `memorizer-snapshot-${ts}.json`;
  return new File([json], fileName, { type: "application/json" });
}
