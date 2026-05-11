const DB_NAME = "memorizationApp";
const CURRENT_SCHEMA_VERSION = 1;

const STORES = {
  decks: {
    keyPath: "id",
    indexes: [
      { name: "name", keyPath: "name", unique: false },
      { name: "updatedAt", keyPath: "updatedAt", unique: false },
      { name: "deletedAt", keyPath: "deletedAt", unique: false }
    ]
  },
  cards: {
    keyPath: "id",
    indexes: [
      { name: "type", keyPath: "type", unique: false },
      { name: "deckId", keyPath: "deckId", unique: false },
      { name: "nextDueAt", keyPath: "cardStats.nextDueAt", unique: false },
      { name: "updatedAt", keyPath: "updatedAt", unique: false },
      { name: "fingerprint", keyPath: "fingerprint", unique: false },
      { name: "masteryPercent", keyPath: "cardStats.masteryPercent", unique: false },
      { name: "deletedAt", keyPath: "deletedAt", unique: false }
    ]
  },
  reviews: {
    keyPath: "id",
    indexes: [
      { name: "cardId", keyPath: "cardId", unique: false },
      { name: "sessionId", keyPath: "sessionId", unique: false },
      { name: "reviewedAt", keyPath: "reviewedAt", unique: false },
      { name: "cardType", keyPath: "cardType", unique: false }
    ]
  },
  sessions: {
    keyPath: "id",
    indexes: [
      { name: "startedAt", keyPath: "startedAt", unique: false },
      { name: "endedAt", keyPath: "endedAt", unique: false },
      { name: "deckId", keyPath: "deckId", unique: false }
    ]
  },
  settings: {
    keyPath: "id",
    indexes: []
  },
  deletedRecords: {
    keyPath: "id",
    indexes: [
      { name: "recordId", keyPath: "recordId", unique: false },
      { name: "storeName", keyPath: "storeName", unique: false },
      { name: "deletedAt", keyPath: "deletedAt", unique: false }
    ]
  },
  syncLog: {
    keyPath: "id",
    indexes: [
      { name: "happenedAt", keyPath: "happenedAt", unique: false },
      { name: "type", keyPath: "type", unique: false }
    ]
  }
};

const ALL_STORE_NAMES = Object.keys(STORES);
