require('./env');

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'light_shade_hms',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  dialect: 'mysql',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
  define: { underscored: true, timestamps: true },
};

module.exports = {
  development: { ...base },
  test: { ...base, database: process.env.DB_TEST_NAME || `${base.database}_test`, logging: false },
  production: { ...base, logging: false },
};
