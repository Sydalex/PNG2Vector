// Ultra-minimal server for debugging
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req: any, res: any) => {
  console.log('Root endpoint hit');
  res.json({ 
    status: 'ok', 
    message: 'Minimal server is working!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req: any, res: any) => {
  console.log('Health endpoint hit');
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
  console.log(`📍 Try: http://localhost:${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);
});

export default app;