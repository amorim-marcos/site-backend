"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      // console.log(!data.product_texture)
      // if (!data.product_texture) {
      //   // console.log("hello???")
      //   throw strapi.errors.badRequest(
      //     "Por favor, selecione uma textura para o BP."
      //   );
      // }
      const product_texture = await strapi
        .query("products-textures")
        .findOne({ id: data.product_texture });

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
      if (!params.avoidHook && data.name) {
        // if (!data.product_texture) {
        //   throw strapi.errors.badRequest(
        //     "Por favor, selecione uma textura para o BP."
        //   );
        // }
        const product_texture = await strapi
          .query("products-textures")
          .findOne({ id: data.product_texture });

        data.name = data.name
          .toLowerCase()
          .split(" ")
          .map((word) => word[0].toUpperCase() + word.substring(1))
          .join(" ");

        const productsWithSameName = await strapi
          .query("products")
          .find({ name: data.name, locale: data.locale });

        if (
          productsWithSameName.length == 0 ||
          (productsWithSameName.length == 1 &&
            productsWithSameName[0].id == data.id)
        ) {
          data.complete_name = data.name;
        } else {
          data.complete_name = data.name + " " + product_texture.name;
        }

        data.complete_name = data.name + " " + product_texture.name;
        data.url_code = data.complete_name
          .normalize("NFD")
          .replace(/[^\w ]/g, "")
          .split(" ")
          .join("-")
          .toLowerCase();

        const productsWithSameUrlCode = await strapi
          .query("products")
          .find({ url_code: data.url_code, locale: data.locale });

        if (
          productsWithSameUrlCode.length > 1 ||
          (productsWithSameUrlCode.length == 1 &&
            productsWithSameUrlCode[0].id != params.id)
        ) {
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
      } else {
        delete params.avoidHook;
      }
    },
  },
};
