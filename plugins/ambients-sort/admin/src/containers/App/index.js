import React from "react";
import { Switch, Route } from "react-router-dom";

import { NotFound } from "strapi-helper-plugin";
import { ThemeProvider } from "styled-components";

import pluginId from "../../pluginId";

import HomePage from "../HomePage";

const theme = {
  colors: {
    backgroundColor: "#ffffff",
    shadows: "#e3e9f3",
  },
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Switch>
        <Route path={`/plugins/${pluginId}`} component={HomePage} exact />
        <Route component={NotFound} />
      </Switch>
    </ThemeProvider>
  );
};

export default App;
