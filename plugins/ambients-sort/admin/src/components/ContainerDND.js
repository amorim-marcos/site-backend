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
  column-gap: 2rem;

  width: 100%;
  max-width: 1536px;
  height: 10%;
`;

export const ContainerDND = ({ collection, onSort }) => {
  const [ambients, setAmbients] = useState(collection);
  const [url, setUrl] = useState("");

  useEffect(() => {
    request(`/${pluginId}/url/`, { method: "GET" })
      .then((res) => setUrl(res.url))
      .catch((err) => errorNotifications(err));
  }, []);

  useEffect(() => {
    onSort(
      ambients.map((ambient, index) => ({
        ...ambient,
        custom_order: index,
      }))
    );
  }, [ambients]);

  const moveCard = useCallback((dragIndex, hoverIndex) => {
    setAmbients((prevCards) =>
      update(prevCards, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevCards[dragIndex]],
        ],
      })
    );
  }, []);

  const renderCard = useCallback(
    (ambient, index) => (
      <Widget
        key={ambient.id}
        id={ambient.id}
        index={index}
        img={url + ambient.gallery_imgs[0]?.img?.url}
        text={ambient.title}
        moveCard={moveCard}
      />
    ),
    [url]
  );

  if (!url) return null;

  return (
    <div style={{ width: `100%`, display: `flex`, justifyContent: `center` }}>
      <Container>
        {ambients.map((ambient, i) => renderCard(ambient, i))}
      </Container>
    </div>
  );
};
