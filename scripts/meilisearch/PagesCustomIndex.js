"use strict";

const client = require("./");
const index = client.index("pages");

client.index("pages").updateFilterableAttributes(["locale"]);
client.index("posts").updateFilterableAttributes(["locale"]);
client.index("products").updateFilterableAttributes(["locale"]);
client.index("products").updateSearchableAttributes(["name", "complete_name", "product_texture"]);

/**
 * Use lifecycles hooks to create pages index.
 * @memberof MeilisearchIndex
 * @method useLifecycles
 * @param {model} model - The model/page name to use.
 * @returns {Object} Object with the lifecycles hooks after (create, update and delete).
 */
function useLifecycles(model) {
  const transformData = (data) => {
    const { created_by, updated_by, id, ...rest } = data;

    return { id: `${model}-${id}`, ...rest };
  };

  return {
    lifecycles: {
      async afterCreate(data) {
        data = transformData(data);
        await index.addDocuments([data]);
      },
      async afterUpdate(data) {
        data = transformData(data);
        await index.updateDocuments([data]);
      },
      async afterDelete(data) {
        data = transformData(data);
        const docs = await index.search("", { q: model });

        await Promise.all(
          // Delete all locales of model
          docs.hits.map((doc) => {
            index.deleteDocument(doc.id);
          })
        );
      },
    },
  };
}

module.exports = useLifecycles;
