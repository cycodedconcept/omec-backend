module.exports = (sequelize, DataTypes) => {
  const Staff = sequelize.define('Staff', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    staffNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    departmentId: DataTypes.INTEGER.UNSIGNED,
    specialization: DataTypes.STRING(150),
    status: { type: DataTypes.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
  }, { tableName: 'staff', underscored: true });
  Staff.associate = ({ User, Department, Appointment, PatientVisit }) => {
    Staff.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    Staff.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
    Staff.hasMany(Appointment, { foreignKey: 'doctorId', as: 'appointments' });
    Staff.hasMany(PatientVisit, { foreignKey: 'staffId', as: 'patientVisits' });
  };
  return Staff;
};
