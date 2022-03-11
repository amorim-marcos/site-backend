import React, { memo, useState, useEffect } from "react";

import { request } from "strapi-helper-plugin";
import { Table } from "@buffetjs/core";

import pluginId from "../pluginId";
import headers from "../utils/headers";
import { errorNotifications } from "../utils/notifications";

import { UpdateButton } from "./Buttons";
import { Wrapper } from "./Wrapper";

const Collections = () => {
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    request(`/${pluginId}/collections/`, {
      method: "GET",
    })
      .then((res) => setCollections(res))
      .catch((err) => errorNotifications(err));
  }, []);

  if (!collections.length) return null;

  return (
    <div className="col-md-12">
      <Wrapper>
        <Table
          className="collections"
          headers={headers}
          rows={collections}
          withBulkAction
          onSelect={(row) => {
            addOrRemoveCollection(row);
          }}
          rowLinks={[
            {
              icon: <UpdateButton forwardedAs="span">Sort</UpdateButton>,
              onClick: (data) => {
                updateCollections({ collection: data.collection });
              },
            },
          ]}
        />
      </Wrapper>
    </div>
  );
};

export default memo(Collections);
