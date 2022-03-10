import React, { memo, useEffect } from "react";
import PropTypes from "prop-types";
import menuItems from "./teste.json";
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

const LeftMenu = ({ shouldUpdateStrapi, version, plugins, setUpdateMenu }) => {
  const location = useLocation();

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

  const filteredCollectionTypeLinks = collectionTypesSectionLinks.filter(
    ({ isDisplayed }) => isDisplayed
  );
  const filteredSingleTypeLinks = singleTypesSectionLinks.filter(
    ({ isDisplayed }) => isDisplayed
  );

  const { sections } = menuItems;

  const menuSections = sections.map((value) => {
    return {
      ...value,
      items: filteredCollectionTypeLinks.filter((item) => {
        return value.items.indexOf(item.label) > -1;
      }),
    };
  });

  // This effect is really temporary until we create the menu api
  // We need this because we need to regenerate the links when the settings are being changed
  // in the content manager configurations list
  useEffect(() => {
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
        {menuSections.length > 0 &&
          menuSections.map((item, i) => {
            if (item.items.length > 0) {
              return (
                <LeftMenuLinksSection
                  key={i}
                  section={item.name}
                  name={item.name}
                  links={item.items}
                  location={location}
                  searchable
                />
              );
            }
          })}
        {filteredCollectionTypeLinks.length > 0 && (
          <LeftMenuLinksSection
            section="collectionTipos"
            name="collectionTipos"
            links={filteredCollectionTypeLinks}
            location={location}
            searchable
          />
        )}
        {filteredSingleTypeLinks.length > 0 && (
          <LeftMenuLinksSection
            section="singleType"
            name="singleType"
            links={filteredSingleTypeLinks}
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
