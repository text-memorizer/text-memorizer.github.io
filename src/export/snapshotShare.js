async function shareOrDownload(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Memorizer Snapshot",
        text: "Backup snapshot for Text Memorizer",
        files: [file]
      });
      return "shared";
    } catch (err) {
      if (err.name === "AbortError") return "cancelled";
      // Fall through to download
    }
  }

  downloadFile(file);
  return "downloaded";
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
