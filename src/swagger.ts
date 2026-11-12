import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Açaí Delivery',
            version: '1.1.0',
            description: 'Cardápio, pedidos e painel administrativo de uma açaiteria. Rotas de admin exigem token Bearer obtido em /auth/login.',
        },
        servers: [{ url: 'http://localhost:3333' }, { url: 'https://api-acai-delivey.onrender.com' }],
        components: {
            securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
        },
        tags: [
            { name: 'Auth', description: 'Login do administrador' },
            { name: 'Produtos', description: 'Cardápio' },
            { name: 'Complementos', description: 'Frutas, coberturas e adicionais' },
            { name: 'Pedidos', description: 'Criação, acompanhamento e status dos pedidos' },
        ],
    },
    // Works both with ts-node (src/*.ts) and with the compiled build (dist/*.js)
    apis: [path.join(__dirname, 'routes', '*.{ts,js}')],
});

export { swaggerUi, swaggerSpec };
