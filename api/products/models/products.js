"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

// Must match plugin_i18n_default_locale in migrations/configs/core_store.json.
// `scale` (display order) is stored per-locale-row but is meant to be a single
// shared order across languages, with pt-BR as the source of truth.
const MASTER_LOCALE = "pt-BR";

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      if (!data.product_texture) {
        throw strapi.errors.badRequest(
          "Por favor, selecione uma textura para o BP."
        );
      }
      let product_texture;

      product_texture = await strapi.query("products-textures").findOne({ id: data.product_texture, locale: data.locale });

      data.name = data.name
        .toLowerCase()
        .split(" ")
        .map((word) => word[0].toUpperCase() + word.substring(1))
        .join(" ");

      const productsWithSameName = await strapi
        .query("products")
        .find({ name: data.name, locale: data.locale });

      if (productsWithSameName.length == 0) {
        data.complete_name = data.name;
      } else {
        data.complete_name = data.name + " " + product_texture.name;
      }

      data.url_code = data.complete_name
        .normalize("NFD")
        .replace(/[^\w ]/g, "")
        .split(" ")
        .join("-")
        .toLowerCase();

      const alreadyExistsProduct = await strapi
        .query("products")
        .count({ url_code: data.url_code, locale: data.locale });

      if (alreadyExistsProduct > 0) {
        throw strapi.errors.badRequest(
          "Já existe uma combinação de nome e textura para outro BP. Por favor, introduza dados diferentes para esses campos."
        );
      }else{
        if (productsWithSameName.length == 1) {
          await strapi.services.products.upgradeCompleteName(
            productsWithSameName[0].id
          );
        }
      }
    },
    async beforeUpdate(params, data) {
      let locale
      let product_texture
      if (!params.avoidHook && data.name) {
        if (!data.product_texture) {
          throw strapi.errors.badRequest(
            "Por favor, selecione uma textura para o BP."
          );
        }
        if(!data.locale){
          locale = (await strapi.query("products").findOne( {id: params.id} ))?.locale
        }else{
          locale = data.locale
        }

        product_texture = await strapi.query("products-textures").findOne({ id: data.product_texture, locale: locale});

        data.name = data.name
          .toLowerCase()
          .split(" ")
          .map((word) => word[0].toUpperCase() + word.substring(1))
          .join(" ");

        const productsWithSameName = await strapi
          .query("products")
          .find({ name: data.name, locale: locale });

        if (
          productsWithSameName.length == 0 ||
          (productsWithSameName.length == 1 &&
            productsWithSameName[0].id == params.id)
        ) {
          data.complete_name = data.name;
        } else {
          data.complete_name = data.name + " " + product_texture.name;
        }

        data.url_code = data.complete_name
          .normalize("NFD")
          .replace(/[^\w ]/g, "")
          .split(" ")
          .join("-")
          .toLowerCase();

        const productsWithSameUrlCode = await strapi
          .query("products")
          .find({ url_code: data.url_code, locale: locale });

        if (
          productsWithSameUrlCode.length > 1 ||
          (productsWithSameUrlCode.length == 1 &&
            productsWithSameUrlCode[0].id != params.id)
        ) {
          throw strapi.errors.badRequest(
            "Já existe uma combinação de nome e textura para outro BP. Por favor, introduza dados diferentes para esses campos."
          );
        }else{
          if (productsWithSameName.length == 1 && productsWithSameName[0].id != params.id) {
            await strapi.services.products.upgradeCompleteName(
              productsWithSameName[0].id
            );
          }
        }
      } else {
        delete params.avoidHook;
      }
    },
    async afterUpdate(result) {
      // The meilisearch plugin does not remove a product from the index when it is
      // unpublished — it only skips re-adding it. We must explicitly delete it.
      if (!result.published_at) {
        try {
          const { MeiliSearch } = require('meilisearch')
          const meiliConfig = strapi.config.plugins?.meilisearch || {}
          const client = new MeiliSearch({
            host: meiliConfig.host || process.env.MEILI_HOST,
            apiKey: meiliConfig.apiKey || process.env.MEILISEARCH_API_KEY,
          })
          strapi.log.info(`[meilisearch] removing draft product ${result.id} from index`)
          await client.index('products').deleteDocument(`products-${result.id}`)
        } catch (e) {
          strapi.log.error(`[meilisearch] draft cleanup error (products): ${e.message}`)
        }
      }

      // Cascade `scale` from the master locale (pt-BR) to its sibling
      // translations, via Strapi i18n's `localizations` relation. Gated to
      // the master locale only: a routine edit to a non-master translation
      // (which always has *some* scale value, since the column defaults to
      // 0) can never push a stale value back onto pt-BR. Propagation is
      // one-directional by construction, and a sibling's own afterUpdate
      // no-ops immediately (locale !== master), so there is no recursion to
      // worry about.
      if (
        result.locale === MASTER_LOCALE &&
        Array.isArray(result.localizations) &&
        result.localizations.length > 0
      ) {
        const siblingIds = result.localizations.map((l) => l.id);
        const siblings = await strapi
          .query("products")
          .find({ id_in: siblingIds });

        await Promise.all(
          siblings
            .filter((sibling) => sibling.scale !== result.scale)
            .map((sibling) =>
              strapi
                .query("products")
                .update({ id: sibling.id }, { scale: result.scale })
            )
        );
      }
    },
  },
};
