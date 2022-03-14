import React, { memo, useEffect, useState, useMemo } from "react";
import PropTypes from "prop-types";
import { useLocation } from "react-router-dom";
import {
  LeftMenuLinksSection,
  LeftMenuFooter,
  LeftMenuHeader,
  LinksContainer,
} from "../../components/LeftMenu";
import Loader from "./Loader";
import Wrapper from "./Wrapper";
import useMenuSections from "./useMenuSections";
import { values } from "lodash";
import { useGlobalContext, request } from "strapi-helper-plugin";

const LeftMenu = ({ shouldUpdateStrapi, version, plugins, setUpdateMenu }) => {
  const location = useLocation();

  const [lemaData, setLemaData] = useState([]);
  const [menuGroups, setMenuGroups] = useState([]);
  const [menuSingles, setMenuSingles] = useState([]);

  const {
    state: {
      isLoading,
      collectionTypesSectionLinks,
      singleTypesSectionLinks,
      generalSectionLinks,
      pluginsSectionLinks,
    },
    toggleLoading,
    generateMenu,
  } = useMenuSections(plugins, shouldUpdateStrapi);

  const filteredCollectionTypeLinks = useMemo(
    () => collectionTypesSectionLinks.filter(({ isDisplayed }) => isDisplayed),
    [collectionTypesSectionLinks]
  );
  const filteredSingleTypeLinks = useMemo(
    () => singleTypesSectionLinks.filter(({ isDisplayed }) => isDisplayed),
    [singleTypesSectionLinks]
  );

  function getLemaData() {
    request("/lema").then((r) => {
      const trated = r.map((item) => {
        item.code = item.code.replaceAll("-", "").replaceAll(".", "");
        return item;
      });
      setLemaData(trated);
    });
  }

  function f() {
    const singles = [];
    const groups = [];

    lemaData.forEach((item) => {
      if (item.type === "group") {
        const collection = filteredCollectionTypeLinks.filter((x) => {
          return item.items.findIndex((v) => v.url === x.destination) > -1;
        });
        const single = filteredSingleTypeLinks.filter((x) => {
          return item.items.findIndex((v) => v.url === x.destination) > -1;
        });
        const sectionItems = [];
        collection.forEach((v) => sectionItems.push(v));
        single.forEach((v) => sectionItems.push(v));
        groups.push({
          ...item,
          items: sectionItems,
        });
      } else {
        const c = filteredCollectionTypeLinks.findIndex((x) => {
          return item.url === x.destination;
        });

        const s = filteredSingleTypeLinks.findIndex((x) => {
          return item.url === x.destination;
        });

        let obj =
          c >= 0 ? filteredCollectionTypeLinks[c] : filteredSingleTypeLinks[s];

        singles.push(obj);
      }

      setMenuGroups(groups);
      setMenuSingles(singles);
    });
  }

  useEffect(() => {
    if (
      lemaData.length > 0 &&
      !!filteredCollectionTypeLinks &&
      !!filteredSingleTypeLinks &&
      filteredCollectionTypeLinks.length > 0 &&
      filteredSingleTypeLinks.length > 0
    ) {
      f();
    }
  }, [lemaData, filteredCollectionTypeLinks, filteredSingleTypeLinks]);

  // This effect is really temporary until we create the menu api
  // We need this because we need to regenerate the links when the settings are being changed
  // in the content manager configurations list
  useEffect(() => {
    getLemaData();
    setUpdateMenu(() => {
      toggleLoading();
      generateMenu();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Wrapper>
      <Loader show={isLoading} />
      <LeftMenuHeader />
      <LinksContainer>
        {menuGroups.length > 0 &&
          menuGroups.map((item, i) => {
            if (item.items.length > 0) {
              return (
                <LeftMenuLinksSection
                  key={i}
                  section={item.code}
                  name={item.code}
                  links={item.items}
                  location={location}
                  searchable
                />
              );
            }
          })}

        {menuSingles.length > 0 && (
          <LeftMenuLinksSection
            section="singleType"
            name="singleType"
            links={menuSingles}
            location={location}
            searchable
          />
        )}

        {pluginsSectionLinks.length > 0 && (
          <LeftMenuLinksSection
            section="plugins"
            name="plugins"
            links={pluginsSectionLinks}
            location={location}
            searchable={false}
            emptyLinksListMessage="app.components.LeftMenuLinkContainer.noPluginsInstalled"
          />
        )}
        {generalSectionLinks.length > 0 && (
          <LeftMenuLinksSection
            section="general"
            name="general"
            links={generalSectionLinks}
            location={location}
            searchable={false}
          />
        )}
      </LinksContainer>
      <LeftMenuFooter key="footer" version={version} />
    </Wrapper>
  );
};

LeftMenu.propTypes = {
  shouldUpdateStrapi: PropTypes.bool.isRequired,
  version: PropTypes.string.isRequired,
  plugins: PropTypes.object.isRequired,
  setUpdateMenu: PropTypes.func.isRequired,
};

export default memo(LeftMenu);
