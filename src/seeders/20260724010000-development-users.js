'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id, name FROM roles WHERE name IN ('Admin', 'Doctor', 'Nurse', 'Receptionist')",
    );
    const roleIds = Object.fromEntries(roles.map((role) => [role.name, role.id]));
    const missing = ['Admin', 'Doctor', 'Nurse', 'Receptionist'].filter((name) => !roleIds[name]);
    if (missing.length) throw new Error(`Run the default roles seeder first. Missing: ${missing.join(', ')}`);

    const now = new Date();
    const passwordHash = await bcrypt.hash('Password123!', 12);
    const userDefinitions = [
      { role_id: roleIds.Admin, email: 'admin@lightshade.local', password_hash: passwordHash, first_name: 'System', last_name: 'Admin', status: 'Active', created_at: now, updated_at: now },
      { role_id: roleIds.Doctor, email: 'doctor@lightshade.local', password_hash: passwordHash, first_name: 'Sample', last_name: 'Doctor', status: 'Active', created_at: now, updated_at: now },
      { role_id: roleIds.Nurse, email: 'nurse@lightshade.local', password_hash: passwordHash, first_name: 'Sample', last_name: 'Nurse', status: 'Active', created_at: now, updated_at: now },
      { role_id: roleIds.Receptionist, email: 'receptionist@lightshade.local', password_hash: passwordHash, first_name: 'Sample', last_name: 'Receptionist', status: 'Active', created_at: now, updated_at: now },
    ];
    const [existingUsers] = await queryInterface.sequelize.query(
      "SELECT email FROM users WHERE email IN ('admin@lightshade.local', 'doctor@lightshade.local', 'nurse@lightshade.local', 'receptionist@lightshade.local')",
    );
    const existingEmails = new Set(existingUsers.map((user) => user.email));
    const missingUsers = userDefinitions.filter((user) => !existingEmails.has(user.email));

    if (missingUsers.length) await queryInterface.bulkInsert('users', missingUsers);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: [
        'admin@lightshade.local',
        'doctor@lightshade.local',
        'nurse@lightshade.local',
        'receptionist@lightshade.local',
      ],
    });
  },
};
