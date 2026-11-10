'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patient_visits', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      patient_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      staff_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'staff', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      visit_date: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      reason: { type: Sequelize.TEXT, allowNull: false },
      diagnosis: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    await queryInterface.addIndex('patient_visits', ['patient_id', 'visit_date'], { name: 'patient_visits_patient_date_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('patient_visits');
  },
};
