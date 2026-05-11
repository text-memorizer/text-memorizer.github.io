function generateId(prefix) {
  return prefix + "_" + crypto.randomUUID().replace(/-/g, "");
}
