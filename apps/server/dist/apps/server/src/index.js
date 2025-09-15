"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
// Basic middleware
app.use(express_1.default.json());
// API endpoints
app.get('/', (req, res) => {
    res.json({
        name: 'PNG2Vector API',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});
app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`🚀 PNG2Vector server running on port ${PORT}`);
});
module.exports = app;
//# sourceMappingURL=index.js.map