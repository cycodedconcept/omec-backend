const auditService = require('../services/audit.service');

const mutationRoutes = [
  { method: 'POST', pattern: /^\/api\/v1\/auth\/users$/, tableName: 'users', action: 'CREATE' },
  { method: 'POST', pattern: /^\/api\/v1\/patients\/[^/]+\/visits$/, tableName: 'patient_visits', action: 'CREATE' },
  { method: 'POST', pattern: /^\/api\/v1\/patients$/, tableName: 'patients', action: 'CREATE' },
  { method: 'PUT', pattern: /^\/api\/v1\/patients\/[^/]+$/, tableName: 'patients', action: 'UPDATE' },
  { method: 'PATCH', pattern: /^\/api\/v1\/patients\/[^/]+\/status$/, tableName: 'patients', action: 'UPDATE_STATUS' },
  { method: 'POST', pattern: /^\/api\/v1\/staff$/, tableName: 'staff', action: 'CREATE' },
  { method: 'PUT', pattern: /^\/api\/v1\/staff\/[^/]+$/, tableName: 'staff', action: 'UPDATE' },
  { method: 'PATCH', pattern: /^\/api\/v1\/staff\/[^/]+\/status$/, tableName: 'staff', action: 'UPDATE_STATUS' },
  { method: 'POST', pattern: /^\/api\/v1\/departments$/, tableName: 'departments', action: 'CREATE' },
  { method: 'PUT', pattern: /^\/api\/v1\/departments\/[^/]+$/, tableName: 'departments', action: 'UPDATE' },
  { method: 'POST', pattern: /^\/api\/v1\/departments\/[^/]+\/assign-staff$/, tableName: 'departments', action: 'ASSIGN_STAFF' },
  { method: 'DELETE', pattern: /^\/api\/v1\/departments\/[^/]+\/staff\/[^/]+$/, tableName: 'departments', action: 'REMOVE_STAFF' },
  { method: 'PATCH', pattern: /^\/api\/v1\/departments\/[^/]+\/capacity$/, tableName: 'departments', action: 'UPDATE_CAPACITY' },
  { method: 'POST', pattern: /^\/api\/v1\/appointments$/, tableName: 'appointments', action: 'CREATE' },
  { method: 'PATCH', pattern: /^\/api\/v1\/appointments\/[^/]+\/reschedule$/, tableName: 'appointments', action: 'RESCHEDULE' },
  { method: 'PATCH', pattern: /^\/api\/v1\/appointments\/[^/]+\/cancel$/, tableName: 'appointments', action: 'CANCEL' },
  { method: 'PATCH', pattern: /^\/api\/v1\/appointments\/[^/]+\/status$/, tableName: 'appointments', action: 'UPDATE_STATUS' },
  { method: 'PATCH', pattern: /^\/api\/v1\/notifications\/[^/]+\/read$/, tableName: 'notifications', action: 'MARK_READ' },
];

const clean = (value) => {
  if (!value || typeof value !== 'object') return value;
  const copy = Array.isArray(value) ? [...value] : { ...value };
  ['password', 'passwordHash', 'token'].forEach((key) => {
    if (Object.hasOwn(copy, key)) copy[key] = '[REDACTED]';
  });
  return copy;
};

function routeMetadata(req) {
  const path = req.originalUrl.split('?')[0].replace(/\/$/, '');
  return mutationRoutes.find((route) => route.method === req.method && route.pattern.test(path));
}

function auditLogger(req, res, next) {
  return auditService.runWithAuditContext(() => {
    const metadata = routeMetadata(req);
    if (!metadata) return next();

    let responseBody;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.once('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || auditService.hasAuditBeenWritten()) return;
      const responseData = responseBody?.data;
      const recordId = responseData?.id ?? req.params?.staffId ?? req.params?.id ?? null;
      auditService.writeAudit({
        userId: req.user?.id || null,
        action: metadata.action,
        tableName: metadata.tableName,
        recordId,
        afterValues: clean(responseData || req.body),
        ipAddress: req.ip,
      }).catch((error) => console.error('Fallback audit logging failed:', error.message));
    });
    return next();
  });
}

module.exports = auditLogger;
module.exports.routeMetadata = routeMetadata;
