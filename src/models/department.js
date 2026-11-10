module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    capacity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
  }, { tableName: 'departments', underscored: true });
  Department.associate = ({ Staff, Appointment }) => {
    Department.hasMany(Staff, { foreignKey: 'departmentId', as: 'staff' });
    Department.hasMany(Appointment, { foreignKey: 'departmentId', as: 'appointments' });
  };
  return Department;
};
