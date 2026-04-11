import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './socket';
import { startReminderCron } from './jobs/reminderCron';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start reminder cron job
startReminderCron();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
