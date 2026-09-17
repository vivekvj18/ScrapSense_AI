import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler } from './utils/errors.js';
import { authRouter } from './modules/auth/authRoutes.js';
import { materialsRouter } from './modules/materials/materialRoutes.js';
import { requestRouter } from './modules/requests/requestRoutes.js';
import { aiRouter } from './modules/ai/aiRoutes.js';
import { managerRouter } from './modules/manager/managerRoutes.js';
import { inventoryRouter } from './modules/inventory/inventoryRoutes.js';
import { analyticsRouter } from './modules/analytics/analyticsRoutes.js';
import { chatbotRouter } from './modules/chatbot/chatbotRoutes.js';
import { notificationRouter } from './modules/notifications/notificationRoutes.js';

export const app = express();

app.use(cors({ origin: env.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ ok: true, mode: env.aiMode }));
app.use('/api/auth', authRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/requests', requestRouter);
app.use('/api/inspections', aiRouter);
app.use('/api', managerRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/chat', chatbotRouter);
app.use('/api/notifications', notificationRouter);
app.use(errorHandler);
