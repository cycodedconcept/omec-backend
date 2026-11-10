const { AuditLog } = require('../models');
const { AsyncLocalStorage } = require('async_hooks');

const auditContext = new AsyncLocalStorage();

function runWithAuditContext(callback) {
  return auditContext.run({ written: false }, callback);
}

function hasAuditBeenWritten() {
  return auditContext.getStore()?.written === true;
}

function writeAudit({ userId, action, tableName, recordId, beforeValues, afterValues, ipAddress, transaction }) {
  const context = auditContext.getStore();
  if (context) context.written = true;
  return AuditLog.create({
    userId,
    action,
    tableName,
    recordId: recordId == null ? null : String(recordId),
    beforeValues: beforeValues || null,
    afterValues: afterValues || null,
    ipAddress: ipAddress || null,
    createdAt: new Date(),
  }, { transaction });
}

module.exports = { writeAudit, runWithAuditContext, hasAuditBeenWritten };
