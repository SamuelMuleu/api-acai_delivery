"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const produto_routes_1 = __importDefault(require("./routes/produto.routes"));
const pedido_routes_1 = __importDefault(require("./routes/pedido.routes"));
const complementos_routes_1 = __importDefault(require("./routes/complementos.routes"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, 'public/uploads')));
app.use(express_1.default.json());
const uploadDir = path_1.default.join(__dirname, 'public/uploads');
require('fs').mkdirSync(uploadDir, { recursive: true });
app.use('/produtos', produto_routes_1.default);
app.use('/pedidos', pedido_routes_1.default);
app.use('/complementos', complementos_routes_1.default);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
