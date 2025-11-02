import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { promptRouter } from './routes/prompts.js';
import { workspaceRouter } from './routes/workspaces.js';
import { contextRouter } from './routes/contexts.js';
import { qualityGateRouter } from './routes/quality-gate.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { logger } from './utils/logger.js';
import { initializeServices, shutdownServices } from './services/index.js';

const app: Express = express();
const PORT = config.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN || '*',
  credentials: true,
}));

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Health check (before other routes, no rate limiting)
app.use('/health', healthRouter);

// API Routes
app.use('/api/v1/prompts', promptRouter);
app.use('/api/v1/workspaces', workspaceRouter);
app.use('/api/v1/contexts', contextRouter);
app.use('/api/v1/quality-gate', qualityGateRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Initialize all Axon services
    logger.info('Initializing Axon services...');
    await initializeServices();
    logger.info('✅ All services initialized successfully');

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Axon API Gateway listening on port ${PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      // Close HTTP server
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Shutdown services
        try {
          await shutdownServices();
          logger.info('Services shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during service shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
