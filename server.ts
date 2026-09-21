import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment configuration
dotenv.config();

// Handlers for Wittypay
import createPaymentHandler from './api/wittypay/create-payment';
import webhookHandler from './api/wittypay/webhook';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Webhook raw-body parser for HMAC signature verification
  app.use('/api/wittypay/webhook', express.raw({ type: '*/*' }), (req: any, res: any, next: any) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString('utf8');
      try {
        req.body = JSON.parse(req.rawBody);
      } catch (e) {
        req.body = {};
      }
    }
    next();
  });

  // Standard JSON parser for other API routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'Ingenium Tech Academy API',
      wittypay_configured: Boolean(process.env.WITTYPAY_SECRET_KEY)
    });
  });

  // Wittypay API Routes
  app.post('/api/wittypay/create-payment', async (req, res) => {
    await createPaymentHandler(req, res);
  });

  app.post('/api/wittypay/webhook', async (req, res) => {
    await webhookHandler(req, res);
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ingenium Academy] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
