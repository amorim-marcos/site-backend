"use strict";

const { MeiliSearch } = require("meilisearch");

const client = new MeiliSearch({
  host: process.env.MEILI_HOST,
  apiKey: process.env.MEILISEARCH_API_KEY,
});

module.exports = client;
