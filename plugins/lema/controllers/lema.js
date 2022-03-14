"use strict";
const fs = require("fs");

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
  addMenuSection: async (ctx) => {
    const availableSections = strapi.config.plugins.lema.sections;
    // console.log(availableSections);

    let sectionsItems = {};
    availableSections.forEach((item) => {
      const code = item.code.replaceAll("-", "").replaceAll(".", "");
      sectionsItems[code] = {
        id: `app.components.LeftMenuLinkContainer.item.${code}`,
        defaultMessage: item.label,
      };
    });

    fs.writeFile(
      "admin/src/components/LeftMenu/LeftMenuLinkHeader/messages.json",
      JSON.stringify({ ...sectionsItems, ...defaultMessages }),
      "utf8",
      function (err) {
        if (err) {
          console.log("An error occured while writing JSON Object to File.");
          return console.log(err);
        }

        console.log("JSON file has been saved.");
      }
    );
    ctx.send("ok");
  },

  index: async (ctx) => {
    const availableSections = strapi.config.plugins.lema.sections;

    let sections = [];
    for (let model in strapi.api) {
      var data =
        strapi.api[model].models[Object.keys(strapi.api[model].models)[0]];
      var section, currentSection, item;

      if (data.pluginOptions["lema"]) {
        currentSection = availableSections.find(
          (section) => section.code == data.pluginOptions["lema"].section_code
        );
        section = sections.find(
          (section) => section.code == data.pluginOptions["lema"].section_code
        );

        // console.log(section)

        item = {
          code: "single_" + data.collectionName,
          label: data.info.name,
          url: `/plugins/content-manager/${data.kind}/${data.uid}`,
          // url: `${strapi.config.admin.url}/plugins/content-manager/${data.kind}/${data.uid}`,
        };

        if (section != undefined) {
          section.items.push(item);
        } else {
          section = {
            code: currentSection.code,
            label: currentSection.label,
            type: "group",
            items: [item],
          };
          sections.push(section);
        }
      } else {
        // Single section line
        sections.push({
          code: "single_" + data.collectionName,
          label: data.info.name,
          type: "single",
          url: `/plugins/content-manager/${data.kind}/${data.uid}`,
          // url: `${strapi.config.admin.url}/plugins/content-manager/${data.kind}/${data.uid}`,
        });
      }
    }
    // Send 200 `ok`
    ctx.send(sections);
  },
};

const defaultMessages = {
  collectionType: {
    id: "app.components.LeftMenuLinkContainer.collectionType",
    defaultMessage: "collection Types",
  },
  singleType: {
    id: "app.components.LeftMenuLinkContainer.singleTypes",
    defaultMessage: "Single Types",
  },
  listPlugins: {
    id: "app.components.LeftMenuLinkContainer.listPlugins",
    defaultMessage: "Plugins",
  },
  installNewPlugin: {
    id: "app.components.LeftMenuLinkContainer.installNewPlugin",
    defaultMessage: "Marketplace",
  },
  configuration: {
    id: "app.components.LeftMenuLinkContainer.configuration",
    defaultMessage: "Configurations",
  },
  plugins: {
    id: "app.components.LeftMenuLinkContainer.plugins",
    defaultMessage: "Plugins",
  },
  general: {
    id: "app.components.LeftMenuLinkContainer.general",
    defaultMessage: "General",
  },
  noPluginsInstalled: {
    id: "app.components.LeftMenuLinkContainer.noPluginsInstalled",
    defaultMessage: "No plugins installed yet",
  },
  settings: {
    id: "app.components.LeftMenuLinkContainer.settings",
    defaultMessage: "Settings",
  },
};
