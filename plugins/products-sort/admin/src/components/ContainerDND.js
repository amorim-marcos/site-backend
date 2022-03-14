import React, { useState, useEffect, useCallback } from "react";

import { request } from "strapi-helper-plugin";

import update from "immutability-helper";
import styled from "styled-components";

import { Widget } from "./Widget";

import pluginId from "../pluginId";
import { errorNotifications } from "../utils/notifications";

const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;

  width: 100%;
  height: 10%;
`;

export const ContainerDND = ({ collection, onSort }) => {
  const [products, setProducts] = useState(collection);
  const [url, setUrl] = useState("");

  useEffect(() => {
    request(`/${pluginId}/url/`, { method: "GET" })
      .then((res) => setUrl(res.url))
      .catch((err) => errorNotifications(err));
  }, []);

  useEffect(() => {
    onSort(
      products.map((product, index) => ({
        ...product,
        scale: index,
      }))
    );
  }, [products]);

  const moveCard = useCallback((dragIndex, hoverIndex) => {
    setProducts((prevCards) =>
      update(prevCards, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevCards[dragIndex]],
        ],
      })
    );
  }, []);

  const renderCard = useCallback(
    (product, index) => (
      <Widget
        key={product.id}
        id={product.id}
        index={index}
        img={url + product.pattern_image.url}
        text={product.complete_name}
        moveCard={moveCard}
      />
    ),
    [url]
  );

  if (!url) return null;

  return (
    <Container>
      {products.map((product, i) => renderCard(product, i))}
    </Container>
  );
};
