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
    const availableSections = strapi.config.plugins.lema.sections

    let sections = []
    for(let model in strapi.api){
      var data = strapi.api[model].models[Object.keys(strapi.api[model].models)[0]]
      var section, currentSection, item

      if(data.pluginOptions["lema"]){
        currentSection = availableSections.find((section) => section.code == data.pluginOptions["lema"].section_code)
        section = sections.find((section) => section.code == data.pluginOptions["lema"].section_code)

        item = {
          code: 'single_'+data.collectionName,
          label: data.info.name,
          url: `${strapi.config.admin.url}/plugins/content-manager/${data.kind}/${data.uid}`
        }

        if(section){
          section.items.push(item)
        }else{
          section = {
            code: currentSection.code,
            label: currentSection.label,
            type: 'group',
            items: [item]
          }
          sections.push(section)
        }
      }else{
        // Single section line
        sections.push({
          code: 'single_'+data.collectionName,
          label: data.info.name,
          type: 'single',
          url: `${strapi.config.admin.url}/plugins/content-manager/${data.kind}/${data.uid}`
        })     
        sections.push(section)  
      }
    }
    // Send 200 `ok`
    ctx.send(sections);
  }
};
