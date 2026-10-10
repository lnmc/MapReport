import { Hono } from 'hono';
import { createPublicConfig, type PublicEnvironment } from './config';

export function createApp() {
  const app = new Hono<{ Bindings: PublicEnvironment }>();

  app.get('/health', (context) => context.json({ status: 'ok' }));
  app.get('/config', (context) => {
    try {
      context.header('Cache-Control', 'public, max-age=60');
      return context.json(createPublicConfig(context.env));
    } catch (error) {
      console.error('Invalid public map configuration', error);
      return context.json({ error: 'Map configuration unavailable' }, 500);
    }
  });

  return app;
}
