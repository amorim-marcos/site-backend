const client = require("../../scripts/meilisearch");
const index = client.index("pages");

const pages = [
  "berneck-teca",
  "berneck-pinus",
  "forest-certification",
  "forest-division",
  "hdf-berneck",
  "mdf-berneck",
  "mdp-berneck",
  "our-commitment",
  "our-trajectory",
  "who-we-are",
];

const transformData = (model, data) => {
  const { created_by, updated_by, id, ...rest } = data;

  return { id: `${model}-${id}`, ...rest };
};

module.exports = (strapi) => {
  return {
    initialize: async () => {
      const indexPages = async (page) => {
        const data = await strapi.query(page).find();

        data.forEach(async (item) => {
          await index.addDocuments([transformData(page, item)]);
        });
      };

      try {
        await Promise.all(pages.map(indexPages));
      } catch (e) {
        console.error(e);
      }
    },
  };
};
