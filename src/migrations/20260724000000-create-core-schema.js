'use strict';

const tableOptions = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };
const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      description: { type: Sequelize.STRING(255), allowNull: true },
      ...timestamps(Sequelize),
    }, tableOptions);

    await queryInterface.createTable('departments', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      capacity: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
      ...timestamps(Sequelize),
    }, tableOptions);

    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      role_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'roles', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      email: { type: Sequelize.STRING(191), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      first_name: { type: Sequelize.STRING(100), allowNull: false },
      last_name: { type: Sequelize.STRING(100), allowNull: false },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      status: { type: Sequelize.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    }, tableOptions);

    await queryInterface.createTable('staff', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      staff_number: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      department_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'departments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      specialization: { type: Sequelize.STRING(150), allowNull: true },
      status: { type: Sequelize.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
      ...timestamps(Sequelize),
    }, tableOptions);

    await queryInterface.createTable('patients', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      patient_number: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      first_name: { type: Sequelize.STRING(100), allowNull: false },
      last_name: { type: Sequelize.STRING(100), allowNull: false },
      date_of_birth: { type: Sequelize.DATEONLY, allowNull: true },
      gender: { type: Sequelize.ENUM('Male', 'Female', 'Other'), allowNull: true },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      email: { type: Sequelize.STRING(191), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      emergency_contact_name: { type: Sequelize.STRING(200), allowNull: true },
      emergency_contact_phone: { type: Sequelize.STRING(30), allowNull: true },
      status: { type: Sequelize.ENUM('Active', 'Admitted', 'Discharged'), allowNull: false, defaultValue: 'Active' },
      ...timestamps(Sequelize),
    }, tableOptions);

    await queryInterface.createTable('appointments', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      patient_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      doctor_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'staff', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      department_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'departments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      appointment_date: { type: Sequelize.DATEONLY, allowNull: false },
      appointment_time: { type: Sequelize.TIME, allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'), allowNull: false, defaultValue: 'Pending' },
      cancellation_reason: { type: Sequelize.TEXT, allowNull: true },
      reschedule_reason: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      ...timestamps(Sequelize),
    }, tableOptions);
    await queryInterface.addIndex('appointments', ['doctor_id', 'appointment_date', 'appointment_time'], { name: 'appointments_doctor_slot_idx' });

    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      type: { type: Sequelize.STRING(50), allowNull: false },
      title: { type: Sequelize.STRING(191), allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      related_type: { type: Sequelize.STRING(50), allowNull: true },
      related_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      read_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    }, tableOptions);
    await queryInterface.addIndex('notifications', ['user_id', 'is_read'], { name: 'notifications_user_unread_idx' });

    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      action: { type: Sequelize.STRING(50), allowNull: false },
      table_name: { type: Sequelize.STRING(100), allowNull: false },
      record_id: { type: Sequelize.STRING(100), allowNull: true },
      before_values: { type: Sequelize.JSON, allowNull: true },
      after_values: { type: Sequelize.JSON, allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }, tableOptions);
    await queryInterface.addIndex('audit_logs', ['table_name', 'record_id'], { name: 'audit_logs_record_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('appointments');
    await queryInterface.dropTable('patients');
    await queryInterface.dropTable('staff');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('departments');
    await queryInterface.dropTable('roles');
  },
};
