const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const healthRouter = require('./routes/health.routes');
const authRouter = require('./routes/auth.routes');
const patientRouter = require('./routes/patient.routes');
const staffRouter = require('./routes/staff.routes');
const departmentRouter = require('./routes/department.routes');
const appointmentRouter = require('./routes/appointment.routes');
const notificationRouter = require('./routes/notification.routes');
const dashboardRouter = require('./routes/dashboard.routes');
const auditLogger = require('./middleware/auditLogger');
const errorHandler = require('./middleware/errorHandler');
const enforceHttps = require('./middleware/https');

const app = express();

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(enforceHttps);
app.use(auditLogger);

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/patients', patientRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/departments', departmentRouter);
app.use('/api/v1/appointments', appointmentRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/dashboard', dashboardRouter);

app.use((req, res) => res.status(404).json({
  success: false,
  data: null,
  error: 'Route not found',
}));

app.use(errorHandler);

module.exports = app;
