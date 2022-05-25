module.exports = async () => {
  await registerPermissionActions();
};

const registerPermissionActions = async () => {
  const actions = [
    {
      section: "plugins",
      displayName: "Read",
      uid: "read",
      pluginName: "products-sort",
    },
  ];
  await strapi.admin.services.permission.actionProvider.registerMany(actions);
  const EDITOR_CODE = strapi.admin.services.constants.EDITOR_CODE;
  const roles = await strapi.admin.services.role.find();
  const editor = roles.find((role) => role.code == EDITOR_CODE);
  const permissions = await strapi.admin.services.permission.find({
    role: editor.id,
    _limit: -1,
  });
  const productsSortPermission = permissions.find(
    (permission) => permission.action == "plugins::products-sort.read"
  );
  if (!productsSortPermission || productsSortPermission.length == 0) {
    await strapi.admin.services.role.addPermissions(editor.id, [
      {
        action: "plugins::products-sort.read",
        subject: null,
      },
    ]);
  }
};
