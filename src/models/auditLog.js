module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: DataTypes.INTEGER.UNSIGNED,
    action: { type: DataTypes.STRING(50), allowNull: false },
    tableName: { type: DataTypes.STRING(100), allowNull: false },
    recordId: DataTypes.STRING(100),
    beforeValues: DataTypes.JSON,
    afterValues: DataTypes.JSON,
    ipAddress: DataTypes.STRING(45),
    createdAt: { type: DataTypes.DATE, allowNull: false },
  }, { tableName: 'audit_logs', underscored: true, updatedAt: false });
  AuditLog.associate = ({ User }) => AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  return AuditLog;
};
