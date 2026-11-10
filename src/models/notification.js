module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(191), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    relatedType: DataTypes.STRING(50),
    relatedId: DataTypes.INTEGER.UNSIGNED,
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    readAt: DataTypes.DATE,
  }, { tableName: 'notifications', underscored: true });
  Notification.associate = ({ User }) => Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  return Notification;
};
