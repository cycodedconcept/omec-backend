const app = require('./app');
const http = require('http');
const env = require('./config/env');
const sequelize = require('./config/db');
const { initializeSocket } = require('./config/socket');

async function start() {
  try {
    await sequelize.authenticate();
    console.log(
      `MySQL connected: ${env.database.username}@${env.database.host}:${env.database.port}/${env.database.name}`,
    );
    const server = http.createServer(app);
    initializeSocket(server, { cors: { origin: env.socketCorsOrigin, methods: ['GET', 'POST'] } });
    server.listen(env.port, () => console.log(`Light Shade HMS API and Socket.IO listening on port ${env.port}`));
    return server;
  } catch (error) {
    console.error('Unable to connect to MySQL:', error.message);
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = { start };
