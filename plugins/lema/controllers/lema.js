'use strict';

/**
 * lema.js controller
 *
 * @description: A set of functions called "actions" of the `lema` plugin.
 */

module.exports = {

  /**
   * Default action.
   *
   * @return {Object}
   */

  index: async (ctx) => {
    // Add your own logic here.
    let sections = []
    for(let model in strapi.api){
      var data = strapi.api[model].models[Object.keys(strapi.api[model].models)[0]]
      var section = {
        name: data.collectionName,
        label: data.info.name,
        url: `${strapi.config.admin.url}/plugins/content-manager/${data.kind}/${data.uid}`
      }
      sections.push(section)
    }
    // Send 200 `ok`
    ctx.send(sections);
  }
};
