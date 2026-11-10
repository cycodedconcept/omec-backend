module.exports = (sequelize, DataTypes) => {
  const Patient = sequelize.define('Patient', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    patientNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    firstName: { type: DataTypes.STRING(100), allowNull: false },
    lastName: { type: DataTypes.STRING(100), allowNull: false },
    dateOfBirth: DataTypes.DATEONLY,
    gender: DataTypes.ENUM('Male', 'Female', 'Other'),
    phone: DataTypes.STRING(30),
    email: { type: DataTypes.STRING(191), validate: { isEmail: true } },
    address: DataTypes.TEXT,
    emergencyContactName: DataTypes.STRING(200),
    emergencyContactPhone: DataTypes.STRING(30),
    status: { type: DataTypes.ENUM('Active', 'Admitted', 'Discharged'), allowNull: false, defaultValue: 'Active' },
  }, { tableName: 'patients', underscored: true });
  Patient.associate = ({ Appointment, PatientVisit }) => {
    Patient.hasMany(Appointment, { foreignKey: 'patientId', as: 'appointments' });
    Patient.hasMany(PatientVisit, { foreignKey: 'patientId', as: 'visits' });
  };
  return Patient;
};
