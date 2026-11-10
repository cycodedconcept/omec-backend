'use strict';

module.exports = {
  async up(queryInterface) {
    const roleDefinitions = [
      { name: 'Admin', description: 'Full system administration access' },
      { name: 'Doctor', description: 'Clinical doctor access' },
      { name: 'Nurse', description: 'Clinical nursing access' },
      { name: 'Receptionist', description: 'Front desk and scheduling access' },
    ];
    const [existingRoles] = await queryInterface.sequelize.query(
      "SELECT name FROM roles WHERE name IN ('Admin', 'Doctor', 'Nurse', 'Receptionist')",
    );
    const existingNames = new Set(existingRoles.map((role) => role.name));
    const now = new Date();
    const missingRoles = roleDefinitions
      .filter((role) => !existingNames.has(role.name))
      .map((role) => ({ ...role, created_at: now, updated_at: now }));

    if (missingRoles.length) await queryInterface.bulkInsert('roles', missingRoles);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', { name: ['Admin', 'Doctor', 'Nurse', 'Receptionist'] });
  },
};
