import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookiePlugin from '@fastify/cookie';
import staticPlugin from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Fastify
const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: false
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
});

await fastify.register(cookiePlugin);

// Serve static files (CSS, JS, images)
try {
  await fastify.register(staticPlugin, {
    root: path.join(__dirname, 'static'),
    prefix: '/static/'
  });
} catch (error) {
  console.log('Static directory not found, skipping static file serving');
}

// Serve assets
try {
  await fastify.register(staticPlugin, {
    root: path.join(__dirname, 'assets'),
    prefix: '/assets/'
  });
} catch (error) {
  console.log('Assets directory not found, skipping assets serving');
}

// Import routes
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import produkRoutes from './routes/produk.js';
import inventoryRoutes from './routes/inventory.js';
import keuanganRoutes from './routes/keuangan.js';

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
await fastify.register(produkRoutes, { prefix: '/api/produk' });
await fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
await fastify.register(keuanganRoutes, { prefix: '/api/keuangan' });

// Health check endpoint
fastify.get('/api/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return { 
    message: 'Toko Rafilah API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    success: false,
    message: 'Endpoint tidak ditemukan'
  });
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    success: false,
    message: error.message || 'Terjadi kesalahan pada server',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// Export fastify app for both local and Vercel
export default fastify;

// Handle Vercel environment
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const isDevelopment = process.env.NODE_ENV === 'development';

// Only listen locally (not on Vercel)
if (!isVercel && !process.argv.includes('--no-listen')) {
  const start = async () => {
    try {
      const port = parseInt(process.env.PORT) || 3000;
      const host = process.env.HOST || '0.0.0.0';
      
      await fastify.listen({ port, host });
      console.log(`✅ Server running on http://${host}:${port}`);
      console.log(`📍 Health check: http://${host}:${port}/api/health`);
    } catch (error) {
      fastify.log.error(error);
      process.exit(1);
    }
  };

  start();
} else if (isVercel) {
  console.log('🚀 Running in Vercel environment - ready to handle requests');
}
