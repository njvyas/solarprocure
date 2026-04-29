require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { testConnection: testDB } = require('./config/database');
const { testConnection: testRedis, redis } = require('./config/redis');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const authRoutes        = require('./routes/auth.routes');
const usersRoutes       = require('./routes/users.routes');
const tenantsRoutes     = require('./routes/tenants.routes');
const vendorsRoutes     = require('./routes/vendors.routes');
const vendorMgmtRoutes  = require('./routes/vendor_mgmt.routes');
const bomsRoutes        = require('./routes/boms.routes');
const rfqsRoutes        = require('./routes/rfqs.routes');
const quotesRoutes      = require('./routes/quotes.routes');
const biddingRoutes     = require('./routes/bidding.routes');
const evaluationsRoutes = require('./routes/evaluations.routes');
const posRoutes         = require('./routes/pos.routes');
const reportsRoutes     = require('./routes/reports.routes');
const backupRoutes      = require('./routes/backup.routes');
const aiRoutes          = require('./routes/ai.routes');
const settingsRoutes    = require('./routes/settings.routes');
const setupRoutes       = require('./routes/setup.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy:{ directives:{ defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'] } }, crossOriginEmbedderPolicy:false }));
app.use(cors({ origin:(process.env.CORS_ORIGINS||'http://localhost:3000').split(','), credentials:true, methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization','X-Request-ID'], exposedHeaders:['X-Request-ID'] }));
app.use(rateLimit({ windowMs:15*60*1000, max:500, standardHeaders:true, legacyHeaders:false, message:{success:false,error:'Too many requests',code:'RATE_LIMIT_EXCEEDED'} }));
app.use(compression());
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));
app.use((req,res,next)=>{ const {v4}=require('uuid'); req.id=req.headers['x-request-id']||v4(); res.setHeader('X-Request-ID',req.id); next(); });
app.use(morgan('combined',{ stream:{write:(m)=>logger.info(m.trim(),{type:'http'})}, skip:(req)=>req.url==='/api/health' }));

app.get('/api/health', async (req,res) => {
  const dbOk=await testDB(), redisOk=await testRedis(), healthy=dbOk&&redisOk;
  res.status(healthy?200:503).json({ status:healthy?'healthy':'degraded', timestamp:new Date().toISOString(), version:'1.0.0', stage:13, services:{database:dbOk?'ok':'error',redis:redisOk?'ok':'error'} });
});

app.use('/api/setup',           setupRoutes);
app.use('/api/auth',            authRoutes);
app.use('/api/users',           usersRoutes);
app.use('/api/tenants',         tenantsRoutes);
app.use('/api/vendors',         vendorsRoutes);
app.use('/api/vendors',         vendorMgmtRoutes);
app.use('/api/boms',            bomsRoutes);
app.use('/api/rfqs',            rfqsRoutes);
app.use('/api/quotes',          quotesRoutes);
app.use('/api/bidding',         biddingRoutes);
app.use('/api/evaluations',     evaluationsRoutes);
app.use('/api/purchase-orders', posRoutes);
app.use('/api/reports',         reportsRoutes);
app.use('/api/backup',          backupRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/settings',        settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

let stopScheduler = null;

async function start() {
  try {
    logger.info('Starting eProcurement API — All 13 Stages', { port:PORT });
    await redis.connect();
    const dbOk = await testDB();
    if (!dbOk) { logger.error('DB connection failed. Exiting.'); process.exit(1); }
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`API running on port ${PORT}`, { environment:process.env.NODE_ENV });
      logger.info('All Stages 1-13 READY');
    });
    // Start backup scheduler
    const { startScheduler } = require('./services/backup.service');
    stopScheduler = startScheduler();
  } catch(err) { logger.error('Failed to start', { error:err.message }); process.exit(1); }
}

process.on('SIGTERM', async () => {
  if (stopScheduler) stopScheduler();
  await redis.quit();
  process.exit(0);
});
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason }));

start();
module.exports = app;
