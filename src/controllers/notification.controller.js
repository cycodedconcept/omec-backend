const { Op } = require('sequelize');
const { Notification, sequelize } = require('../models');
const auditService = require('../services/audit.service');
const notificationService = require('../services/notification.service');
const { success, failure } = require('../utils/response');

async function list(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const where = { userId: req.user.id };
    if (req.query.isRead !== undefined) where.isRead = req.query.isRead === 'true';
    if (req.query.type) where.type = req.query.type;
    if (req.query.search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${req.query.search}%` } },
        { message: { [Op.like]: `%${req.query.search}%` } },
      ];
    }
    const [{ count, rows }, unreadCount] = await Promise.all([
      Notification.findAndCountAll({
        where, limit, offset: (page - 1) * limit, order: [['createdAt', 'DESC']],
      }),
      Notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);
    return success(res, {
      items: rows,
      unreadCount,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const notification = await Notification.findOne({
        where: { id: req.params.id, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!notification) return null;
      if (!notification.isRead) {
        const before = { isRead: false, readAt: notification.readAt };
        await notification.update({ isRead: true, readAt: new Date() }, { transaction });
        await auditService.writeAudit({
          userId: req.user.id,
          action: 'MARK_READ',
          tableName: 'notifications',
          recordId: notification.id,
          beforeValues: before,
          afterValues: { isRead: true, readAt: notification.readAt },
          ipAddress: req.ip,
          transaction,
        });
      }
      return notification;
    });
    if (!result) return failure(res, 'Notification not found', 404);
    notificationService.emitToUser(req.user.id, 'notification:read', notificationService.publicNotification(result));
    return success(res, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, markRead };
