const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const models = {
  Role: require('./role')(sequelize, DataTypes),
  Department: require('./department')(sequelize, DataTypes),
  User: require('./user')(sequelize, DataTypes),
  Staff: require('./staff')(sequelize, DataTypes),
  Patient: require('./patient')(sequelize, DataTypes),
  Appointment: require('./appointment')(sequelize, DataTypes),
  Notification: require('./notification')(sequelize, DataTypes),
  AuditLog: require('./auditLog')(sequelize, DataTypes),
  PatientVisit: require('./patientVisit')(sequelize, DataTypes),
};

Object.values(models).forEach((model) => model.associate?.(models));

module.exports = { sequelize, ...models };
