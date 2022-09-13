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

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [sortedProducts, setSortedProducts] = useState([]);

  const { formatMessage } = useGlobalContext();

  const handleClickSave = async () => {
    request(`/${pluginId}/products/`, {
      method: "PUT",
      body: {
        sortedProducts: sortedProducts.map((item) => ({
          id: item.id,
          scale: item.scale,
        })),
      },
    })
      .then(() => successNotification("Successfully saved"))
      .catch((err) => errorNotifications(err));
  };

  useEffect(() => {
    request(`/${pluginId}/products/`, {
      method: "GET",
    })
      .then((res) => {
        if (res.lenght === 0) errorNotifications("No products found");

        setProducts(res);
      })
      .catch((err) => errorNotifications(err));
  }, []);

  if (!products.length) return null;

  return (
    <div className="container-fluid" style={{ padding: "18px 30px 66px 30px" }}>
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

      <Wrapper style={{ width: "100%" }}>
        <DndProvider backend={HTML5Backend}>
          <ContainerDND
            collection={products}
            onSort={(data) => setSortedProducts(data)}
          />
        </DndProvider>
      </Wrapper>
    </div>
  );
};

export default memo(HomePage);
