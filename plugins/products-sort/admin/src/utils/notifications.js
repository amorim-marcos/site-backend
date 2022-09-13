export function errorNotifications({ message, link }) {
  strapi.notification.toggle({
    title: "Operation failed",
    type: "warning",
    message: message,
    blockTransition: true,
  });
}

export function successNotification({ message, duration = 4000, link }) {
  strapi.notification.toggle({
    type: "success",
    message: message,
    timeout: duration,
  });
}
