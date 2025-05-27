import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import produtosRoutes from './routes/produto.routes';
import pedidosRoutes from './routes/pedido.routes';
import complementosRoutes from './routes/complementos.routes';
import path from 'path';

dotenv.config();
const app = express();

app.use(cors());

const uploadDir = path.join(__dirname, 'public/uploads');
require('fs').mkdirSync(uploadDir, { recursive: true });
const publicUploadsPath = path.join(process.cwd(), 'public', 'uploads');

app.use('/uploads', express.static(publicUploadsPath));
app.use(express.json());

app.use('/produtos', produtosRoutes);

app.use('/pedidos', pedidosRoutes);
app.use('/complementos', complementosRoutes);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

