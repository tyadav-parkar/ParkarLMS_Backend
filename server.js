require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const { globalErrorHandler, notFoundHandler, requestIdMiddleware } = require('./src/core/utils/asyncWrapper');
const { sequelize } = require('./src/core/config/database');
const authRoutes = require('./src/modules/auth');
const roleRoutes = require('./src/modules/roles');
const userRoutes = require('./src/modules/users');
const teamRoutes = require('./src/modules/team');
const importRoutes = require('./src/modules/import'); 

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(requestIdMiddleware);
app.use(helmet());

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [process.env.FRONTEND_URL];

    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];

    const allAllowed = [...allowedOrigins, ...devOrigins];

    if (!origin || allAllowed.includes(origin)) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true);
      }
    }
  },
  credentials:     true,
  methods:         ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders:  ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Requested-With'],
  exposedHeaders:  ['X-Request-ID', 'X-Total-Count'],
  maxAge:          86400,
};
app.use(cors(corsOptions));

const apiLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message:        { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders:  false,
  skip:           (req) => ['/health', '/health/ready', '/health/live'].includes(req.path),
});

const authLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   5,
  skipSuccessfulRequests: true,
  message:               { success: false, message: 'Too many authentication attempts, please try again after 15 minutes' },
  standardHeaders:       true,
  legacyHeaders:         false,
});

app.use('/api/',      apiLimiter);
app.use('/api/auth/', authLimiter);

app.use(cookieParser());
app.use(express.json({ limit: '10kb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/auth',  authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/import', importRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), requestId: req.id });
});

app.get('/health/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ ready: true, requestId: req.id });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message, requestId: req.id });
  }
});

app.get('/health/live', (req, res) => {
  res.status(200).json({ alive: true, requestId: req.id });
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (err) {
    console.error('❌ Unable to connect to the database:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Request ID tracking enabled`);
    console.log(`🛡️  Rate limiting enabled`);
  });

  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('HTTP server closed');
      try {
        await sequelize.close();
        console.log('Database connections closed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
}

startServer();