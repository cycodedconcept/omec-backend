const { Server } = require('socket.io');
const { User, Role, Staff } = require('../models');
const tokenService = require('../services/token.service');

let io;

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken.replace(/^Bearer\s+/i, '');
  const header = socket.handshake.headers.authorization;
  return header?.replace(/^Bearer\s+/i, '');
}

function initializeSocket(httpServer, options = {}) {
  io = new Server(httpServer, {
    cors: { origin: options.corsOrigin || '*', methods: ['GET', 'POST'] },
    ...options,
  });

  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error('Authentication required'));
      const payload = tokenService.verifyToken(token);
      if (payload.type !== 'access' || tokenService.isRevoked(payload.jti)) {
        return next(new Error('Invalid or revoked token'));
      }
      const user = await User.unscoped().findByPk(payload.sub, {
        attributes: { exclude: ['passwordHash'] },
        include: [
          { model: Role, as: 'role', attributes: ['id', 'name'] },
          { model: Staff, as: 'staffProfile', attributes: ['id', 'status'], required: false },
        ],
      });
      if (!user || user.status !== 'Active' || user.staffProfile?.status === 'Inactive') {
        return next(new Error('User account is inactive or unavailable'));
      }
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error(error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join('dashboard');
    if (socket.user.role?.name === 'Doctor' && socket.user.staffProfile?.id) {
      socket.join(`doctor:${socket.user.staffProfile.id}`);
    }
    socket.emit('socket:ready', {
      userId: socket.user.id,
      role: socket.user.role?.name,
      staffId: socket.user.staffProfile?.id || null,
    });
  });

  return io;
}

function getIo() {
  return io;
}

function clearSocket() {
  io = undefined;
}

module.exports = { initializeSocket, getIo, clearSocket };
