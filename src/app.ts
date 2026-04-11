import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { hotelMiddleware } from './middlewares/hotel';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach hotel context to every request
app.use(hotelMiddleware);

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message ?? 'Internal server error' });
});

export default app;
