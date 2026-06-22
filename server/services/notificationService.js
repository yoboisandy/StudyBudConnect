import Notification from "../models/Notification.js";

let _io = null;

/** Call once from socket/index.js after io is created. */
export function initNotificationService(io) {
  _io = io;
}

/**
 * Create a notification in DB and push it to the recipient in real-time.
 *
 * @param {object} opts
 * @param {string|ObjectId} opts.recipient  - User._id
 * @param {string}          opts.type       - NOTIFICATION_TYPES value
 * @param {string}          opts.title
 * @param {string}          opts.body
 * @param {object}          [opts.data]     - arbitrary payload for the client
 */
export async function notify({ recipient, type, title, body, data = {} }) {
  const notif = await Notification.create({ recipient, type, title, body, data });
  if (_io) {
    _io.to(`user:${recipient.toString()}`).emit("notification", notif);
  }
  return notif;
}
