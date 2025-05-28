import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API para açaiteria',
            version: '1.0.0',
        },
        servers: [
            { url: 'http://localhost:3333', },
            { url: 'https://api-acai-delivey.onrender.com', },
        ],
    },
    tags: [

        {
            name: 'Complementos',
            description: 'Gerenciamento de complementos (adicionais, ingredientes, etc.)'
        }
        ,
        {
            name: 'Produtos',
            description: 'Gerenciamento de produtos do sistema'
        },
        {
            name: 'Pedidos',
            description: 'Gerenciamento de complementos (adicionais, ingredientes, etc.)'
        }
    ],
    apis: ['./src/routes/*.ts']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerUi, swaggerSpec };

export { swaggerUi, swaggerSpec };
