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

    return { id: `${model}-${id}`, real_id: id, ...rest };
  };

  return {
    lifecycles: {
      async afterCreate(data) {
        if(data){
          data = transformData(data);
          await index.addDocuments([data]);
        }
      },
      async afterUpdate(data) {
        if(data){
          data = transformData(data);
          await index.updateDocuments([data]);
        }
      },
      async beforeDelete(data){
        console.log(data);
        if(data.id){ // if deleting specifically document
          const docs = await index.search("", { q: model });
          const doc = docs.hits.find((doc) => doc.real_id == data.id);

          if(doc){
            await index.deleteDocument(doc.id);
          }
        }else if(data.locale){ // if deleting locale
          const docs = await index.search("");

          await Promise.all(
            // Delete all locales of model
            docs.hits.filter((doc) => doc.locale == data.locale).map((doc) => {
              index.deleteDocument(doc.id);
            })
          );
        }
      }
    },
  };
}

module.exports = useLifecycles;
