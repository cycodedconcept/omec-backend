const { Notification, User, Role } = require('../models');
const { getIo } = require('../config/socket');

async function createNotification(values, transaction) {
  return Notification.create({
    userId: values.userId,
    type: values.type,
    title: values.title,
    message: values.message,
    relatedType: values.relatedType || null,
    relatedId: values.relatedId || null,
    isRead: false,
  }, { transaction });
}

async function createAdminNotifications(values, transaction) {
  const adminRole = await Role.findOne({ where: { name: 'Admin' }, attributes: ['id'], transaction });
  if (!adminRole) return [];
  const admins = await User.findAll({
    where: { roleId: adminRole.id, status: 'Active' }, attributes: ['id'], transaction,
  });
  const notifications = [];
  const excluded = new Set(values.excludeUserIds || []);
  for (const admin of admins) {
    if (excluded.has(admin.id)) continue;
    notifications.push(await createNotification({ ...values, userId: admin.id }, transaction));
  }
  return notifications;
}

function emitNotifications(notifications) {
  notifications.forEach(emitNotification);
}

function publicNotification(notification) {
  return notification.toJSON ? notification.toJSON() : { ...notification };
}

function emitToUser(userId, event, payload) {
  getIo()?.to(`user:${userId}`).emit(event, payload);
}

function emitToDoctor(staffId, event, payload) {
  getIo()?.to(`doctor:${staffId}`).emit(event, payload);
}

function emitNotification(notification) {
  emitToUser(notification.userId, 'notification:new', publicNotification(notification));
}

module.exports = {
  createNotification,
  createAdminNotifications,
  emitNotifications,
  publicNotification,
  emitToUser,
  emitToDoctor,
  emitNotification,
};
