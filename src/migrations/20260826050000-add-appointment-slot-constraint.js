'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('appointments', 'slot_key', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Unique for active doctor/date/time slots; NULL for cancelled appointments',
    });
    await queryInterface.sequelize.query(`
      UPDATE appointments
      SET slot_key = CONCAT(
        doctor_id, '|', appointment_date, '|', TIME_FORMAT(appointment_time, '%H:%i:%s')
      )
      WHERE status <> 'Cancelled'
    `);
    await queryInterface.addConstraint('appointments', {
      fields: ['slot_key'],
      type: 'unique',
      name: 'appointments_active_slot_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('appointments', 'appointments_active_slot_unique');
    await queryInterface.removeColumn('appointments', 'slot_key');
  },
};
