import React, { memo, useState, useEffect } from "react";

import { DndProvider } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";

import { useGlobalContext, request } from "strapi-helper-plugin";
import { Header } from "@buffetjs/custom";
import { Button } from "@buffetjs/core";

import { Wrapper, Flex } from "../../components/Wrapper";
import { ContainerDND } from "../../components/ContainerDND";

import pluginId from "../../pluginId";
import getTrad from "../../utils/getTrad";
import {
  errorNotifications,
  successNotification,
} from "../../utils/notifications";
import { SiteHeader } from "../../components/SiteHeader";

const HomePage = () => {
  const [ambients, setAmbients] = useState([]);
  const [sortedAmbients, setSortedAmbients] = useState([]);

  const { formatMessage } = useGlobalContext();

  const handleClickSave = async () => {
    request(`/${pluginId}/ambients/`, {
      method: "PUT",
      body: {
        sortedAmbients: sortedAmbients.map((item) => ({
          id: item.id,
          custom_order: item.custom_order,
        })),
      },
    })
      .then(() => successNotification("Successfully saved"))
      .catch((err) => errorNotifications(err));
  };

  useEffect(() => {
    request(`/${pluginId}/ambients/`, {
      method: "GET",
    })
      .then((res) => {
        if (res.lenght === 0) errorNotifications("No ambients found");

        setAmbients(res);
      })
      .catch((err) => errorNotifications(err));
  }, []);

  if (!ambients.length) return null;

  return (
    <div className="container-fluid" style={{ padding: "0px 30px 66px 30px" }}>
      <Flex>
        <Header
          title={{
            label: formatMessage({ id: getTrad("plugin.name") }),
          }}
          content={formatMessage({ id: getTrad("header.description") })}
        />

        <Flex>
          <Button
            color="primary"
            className="save_button"
            onClick={() => handleClickSave()}
            style={{ width: "120px", marginBottom: "20px", marginTop: "20px" }}
          >
            Save
          </Button>
        </Flex>
      </Flex>

      <SiteHeader />
      <Wrapper
        style={{ width: "100%", justifyContent: "center", display: "flex" }}
      >
        <DndProvider backend={HTML5Backend}>
          <div style={{ maxWidth: "1536px" }}>
            <ContainerDND
              collection={ambients}
              onSort={(data) => setSortedAmbients(data)}
            />
          </div>
        </DndProvider>
      </Wrapper>
    </div>
  );
};

export default memo(HomePage);
