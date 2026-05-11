let _key = null;

function cryptoIsUnlocked() { return _key !== null; }
function cryptoClearKey() { _key = null; }

function _b64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function _unb64(b64) {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

async function cryptoGenerateSalt() {
  return _b64(crypto.getRandomValues(new Uint8Array(16)));
}

async function cryptoDeriveKey(password, saltBase64) {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: _unb64(saltBase64), iterations: 250000, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptCardPayload(payload) {
  if (!_key) throw new Error("Vault is locked");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    _key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return { encrypted: true, iv: _b64(iv), ciphertext: _b64(new Uint8Array(ciphertext)) };
}

async function decryptCardPayload(envelope) {
  if (!envelope || envelope.encrypted !== true) return envelope;
  if (!_key) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: _unb64(envelope.iv) },
      _key,
      _unb64(envelope.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

async function cryptoSetupKey(password) {
  const salt = await cryptoGenerateSalt();
  _key = await cryptoDeriveKey(password, salt);
  const verifyEnvelope = await encryptCardPayload({ verify: true });
  return { salt, verifyEnvelope };
}

async function cryptoUnlock(password, saltBase64, verifyEnvelope) {
  const key = await cryptoDeriveKey(password, saltBase64);
  const prev = _key;
  _key = key;
  const result = await decryptCardPayload(verifyEnvelope);
  if (!result || result.verify !== true) {
    _key = prev;
    throw new Error("Wrong password");
  }
}

// Higher-level helpers that include title/tags/deck name in the encrypted payload

async function encryptCardData(card) {
  if (!_key) throw new Error("Vault is locked");
  const result = { ...card, title: "", tags: [] };
  if (card.type === "standard" && card.standardCard) {
    result.standardCard = await encryptCardPayload({
      title: card.title, tags: card.tags,
      frontMarkdown: card.standardCard.frontMarkdown,
      backMarkdown: card.standardCard.backMarkdown
    });
  } else if (card.type === "text-memory" && card.textMemoryCard) {
    result.textMemoryCard = await encryptCardPayload({
      title: card.title, tags: card.tags,
      text: card.textMemoryCard.text,
      preserveLineBreaks: card.textMemoryCard.preserveLineBreaks,
      tokens: card.textMemoryCard.tokens
    });
  }
  return result;
}

async function decryptCardData(card) {
  const result = { ...card };
  if (card.standardCard && card.standardCard.encrypted) {
    const dec = await decryptCardPayload(card.standardCard);
    if (!dec) return null;
    result.title = dec.title !== undefined ? dec.title : card.title;
    result.tags = dec.tags !== undefined ? dec.tags : card.tags;
    result.standardCard = { frontMarkdown: dec.frontMarkdown, backMarkdown: dec.backMarkdown };
  }
  if (card.textMemoryCard && card.textMemoryCard.encrypted) {
    const dec = await decryptCardPayload(card.textMemoryCard);
    if (!dec) return null;
    result.title = dec.title !== undefined ? dec.title : card.title;
    result.tags = dec.tags !== undefined ? dec.tags : card.tags;
    result.textMemoryCard = { text: dec.text, preserveLineBreaks: dec.preserveLineBreaks, tokens: dec.tokens };
  }
  return result;
}

async function encryptDeck(deck) {
  if (!_key) throw new Error("Vault is locked");
  return {
    ...deck,
    name: "",
    encryptedName: await encryptCardPayload({ name: deck.name })
  };
}

async function decryptDeck(deck) {
  if (!deck.encryptedName || !deck.encryptedName.encrypted) return deck;
  if (!_key) return null;
  const dec = await decryptCardPayload(deck.encryptedName);
  if (!dec) return null;
  return { ...deck, name: dec.name };
}
