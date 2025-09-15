import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());

// API endpoints
app.get('/', (req: any, res: any) => {
  res.json({
    name: 'PNG2Vector API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req: any, res: any) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 PNG2Vector server running on port ${PORT}`);
});

module.exports = app;
