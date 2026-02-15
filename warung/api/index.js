import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookiePlugin from '@fastify/cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Fastify instance
let fastifyInstance = null;

async function createFastifyApp() {
  if (fastifyInstance) {
    return fastifyInstance;
  }

  const fastify = Fastify({
    logger: {
      level: 'info',
      prettyPrint: process.env.NODE_ENV !== 'production'
    }
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

  // Import routes
  const { default: authRoutes } = await import('../routes/auth.js');
  const { default: dashboardRoutes } = await import('../routes/dashboard.js');
  const { default: produkRoutes } = await import('../routes/produk.js');
  const { default: inventoryRoutes } = await import('../routes/inventory.js');
  const { default: keuanganRoutes } = await import('../routes/keuangan.js');

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await fastify.register(produkRoutes, { prefix: '/api/produk' });
  await fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
  await fastify.register(keuanganRoutes, { prefix: '/api/keuangan' });

  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return {
      message: 'Toko Rafilah API Server',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString()
    };
  });

  // Health check endpoint
  fastify.get('/api/health', async (request, reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV 
    };
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    console.log(`404 - ${request.method} ${request.url}`);
    reply.status(404).send({
      success: false,
      message: 'Endpoint tidak ditemukan',
      path: request.url
    });
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    console.error(`Error - ${request.method} ${request.url}:`, error);
    reply.status(error.statusCode || 500).send({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server',
      path: request.url,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        stack: error.stack 
      })
    });
  });

  fastifyInstance = fastify;
  return fastify;
}

// Vercel serverless handler
export default async (req, res) => {
  try {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    const app = await createFastifyApp();

    // Inject request into fastify
    app.inject(
      {
        method: req.method,
        url: req.url,
        headers: req.headers,
        payload: req
      },
      (err, response) => {
        if (err) {
          console.error('Fastify inject error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
          }));
          return;
        }

        res.statusCode = response.statusCode;
        
        // Set response headers
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Send response
        res.end(response.rawPayload || response.payload);
      }
    );
  } catch (error) {
    console.error('Handler error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }));
  }
};


