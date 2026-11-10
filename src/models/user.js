module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    roleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    email: { type: DataTypes.STRING(191), allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    firstName: { type: DataTypes.STRING(100), allowNull: false },
    lastName: { type: DataTypes.STRING(100), allowNull: false },
    phone: DataTypes.STRING(30),
    status: { type: DataTypes.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
    lastLoginAt: DataTypes.DATE,
  }, { tableName: 'users', underscored: true, defaultScope: { attributes: { exclude: ['passwordHash'] } } });
  User.associate = ({ Role, Staff, Notification, AuditLog, PatientVisit }) => {
    User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
    User.hasOne(Staff, { foreignKey: 'userId', as: 'staffProfile' });
    User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
    User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
    User.hasMany(PatientVisit, { foreignKey: 'createdBy', as: 'createdPatientVisits' });
  };
  return User;
};
