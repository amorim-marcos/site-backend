const data = require("./admin/src/components/LeftMenu/LeftMenuLinkHeader/messages.json");
const fs = require("fs");

var jsonContent = JSON.stringify(data);

fs.writeFile(
  "admin/src/containers/LeftMenu/output.json",
  jsonContent,
  "utf8",
  function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }

    console.log("JSON file has been saved.");
  }
);
