import React, { useRef } from "react";

import { useDrag, useDrop } from "react-dnd";
import styled from "styled-components";
import { Text } from "@buffetjs/core";

import { Flex } from "./Wrapper";

import { ItemTypes } from "../utils/ItemTypes";

const Container = styled.div`
  z-index: 10;
  width: 33%;

  cursor: move;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -o-user-select: none;
  user-select: none;
  padding: 20px;
  box-shadow: 0 2px 4px #b0b6bf;
  border-radius: 10px;

  transition: all 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 2px 4px #556887;
  }
`;

const Image = styled.img`
  z-index: 10;

  border-radius: 10px;
  object-fit: cover;
  /* height: 5rem; */
  height: 100%;
  width: 100%;
`;

export const Widget = ({ id, index, text, moveCard, img }) => {
  const ref = useRef(null);

  const [{ isDragging }, drag] = useDrag({
    item: { id, index, type: ItemTypes.WIDGET },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const [{ handlerId }, drop] = useDrop({
    accept: ItemTypes.WIDGET,
    collect(monitor) {
      return { handlerId: monitor.getHandlerId() };
    },
    hover(item, monitor) {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <Container
      ref={ref}
      style={{ opacity: isDragging ? 0 : 1 }}
      data-handler-id={handlerId}
    >
      <Image src={img} alt="ambient" />
      <Flex style={{ justifyContent: "space-between" }}>
        <Text
          lineHeight={"6rem"}
          fontWeight="bold"
          fontSize="md"
          style={{ width: "20rem" }}
        >
          {text}
        </Text>

        <Text lineHeight={"6rem"} fontWeight="bold" fontSize="md">
          Position: {index + 1}
        </Text>
      </Flex>
    </Container>
  );
};
