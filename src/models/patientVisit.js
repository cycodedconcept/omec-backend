module.exports = (sequelize, DataTypes) => {
  const PatientVisit = sequelize.define('PatientVisit', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    staffId: DataTypes.INTEGER.UNSIGNED,
    visitDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reason: { type: DataTypes.TEXT, allowNull: false },
    diagnosis: DataTypes.TEXT,
    notes: DataTypes.TEXT,
    createdBy: DataTypes.INTEGER.UNSIGNED,
  }, { tableName: 'patient_visits', underscored: true });

  PatientVisit.associate = ({ Patient, Staff, User }) => {
    PatientVisit.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
    PatientVisit.belongsTo(Staff, { foreignKey: 'staffId', as: 'staff' });
    PatientVisit.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  };
  return PatientVisit;
};
