module.exports = (sequelize, DataTypes) => {
  const Appointment = sequelize.define('Appointment', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    doctorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    departmentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    appointmentDate: { type: DataTypes.DATEONLY, allowNull: false },
    appointmentTime: { type: DataTypes.TIME, allowNull: false },
    slotKey: { type: DataTypes.STRING(100), allowNull: true, unique: 'appointments_active_slot_unique' },
    reason: DataTypes.TEXT,
    status: { type: DataTypes.ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'), allowNull: false, defaultValue: 'Pending' },
    cancellationReason: DataTypes.TEXT,
    rescheduleReason: DataTypes.TEXT,
    createdBy: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'appointments', underscored: true });
  Appointment.associate = ({ Patient, Staff, Department, User }) => {
    Appointment.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
    Appointment.belongsTo(Staff, { foreignKey: 'doctorId', as: 'doctor' });
    Appointment.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
    Appointment.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  };
  return Appointment;
};
