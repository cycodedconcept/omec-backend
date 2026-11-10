module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    description: DataTypes.STRING(255),
  }, { tableName: 'roles', underscored: true });
  Role.associate = ({ User }) => Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
  return Role;
};
