// Minimal server for debugging
import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
});

export default app;