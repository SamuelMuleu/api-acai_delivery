import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PedidoStatus } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();


/**
 * @swagger
 * /pedidos:
 *   get:
 *     summary: Lista todos os pedidos
 *     tags:
 *       - Pedidos
 *     responses:
 *       200:
 *         description: Lista de pedidos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   nomeCliente:
 *                     type: string
 *                   telefone:
 *                     type: string
 *                   endereco:
 *                     type: string
 *                   metodoPagamento:
 *                     type: string
 *                   status:
 *                     type: string
 *                   criadoEm:
 *                     type: string
 *                     format: date-time
 *                   produtos:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         produto:
 *                           type: object
 *                         tamanho:
 *                           type: string
 *                         preco:
 *                           type: number
 *                         complementos:
 *                           type: array
 *                           items:
 *                             type: object
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */

router.get('/', async (_, res) => {
    try {
        const pedidos = await prisma.pedido.findMany({
            orderBy: {
                criadoEm: 'asc'
            }
        });
        res.json(pedidos);
    } catch (error: unknown) {
        console.error('Erro ao buscar complementos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


/**
 * @swagger
 * /pedidos:
 *   post:
 *     summary: Cria um novo pedido
 *     tags:
 *       - Pedidos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nomeCliente
 *               - telefone
 *               - endereco
 *               - metodoPagamento
 *               - produtos
 *             properties:
 *               nomeCliente:
 *                 type: string
 *               telefone:
 *                 type: string
 *               endereco:
 *                 type: string
 *               metodoPagamento:
 *                 type: string
 *               produtos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - produtoId
 *                     - tamanho
 *                   properties:
 *                     produtoId:
 *                       type: integer
 *                     tamanho:
 *                       type: string
 *                     complementos:
 *                       type: array
 *                       items:
 *                         type: integer
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 nomeCliente:
 *                   type: string
 *                 telefone:
 *                   type: string
 *                 endereco:
 *                   type: string
 *                 metodoPagamento:
 *                   type: string
 *                 status:
 *                   type: string
 *                 criadoEm:
 *                   type: string
 *                   format: date-time
 *                 produtos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       produto:
 *                         type: object
 *                       tamanho:
 *                         type: string
 *                       preco:
 *                         type: number
 *                       complementos:
 *                         type: array
 *                         items:
 *                           type: object
 *                 detalhesPrecos:
 *                   type: object
 *                   properties:
 *                     valorTotal:
 *                       type: number
 *                     itens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           produtoId:
 *                             type: integer
 *                           precoBase:
 *                             type: number
 *                           precoComplementos:
 *                             type: number
 *                           precoTotal:
 *                             type: number
 *       400:
 *         description: Dados incompletos ou inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 message:
 *                   type: string
 */

// Criar novo pedido
router.post('/', async (req, res): Promise<any> => {
    try {
        const {
            nomeCliente,
            telefone,
            endereco,
            metodoPagamento,
            produtos
        } = req.body;

        // Validação básica
        if (!nomeCliente || !telefone || !endereco || !metodoPagamento || !produtos) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        // Calcular valor total com complementos
        let valorTotal = 0;
        const produtosComPrecos = await Promise.all(
            produtos.map(async (produto: any) => {
                // Buscar o produto no banco para verificar preço base
                const produtoInfo = await prisma.produto.findUnique({
                    where: { id: produto.produtoId }
                });

                if (!produtoInfo) {
                    throw new Error(`Produto com ID ${produto.produtoId} não encontrado`);
                }

                // Encontrar o preço do tamanho selecionado
                const tamanhosArray = produtoInfo.tamanhos as unknown as Array<{
                    tamanho: string;
                    preco: number;
                }>;

                const tamanhoSelecionado = tamanhosArray.find(t => t.tamanho === produto.tamanho);
                if (!tamanhoSelecionado) {
                    throw new Error(`Tamanho ${produto.tamanho} não disponível para o produto`);
                }

                let precoProduto = tamanhoSelecionado.preco;
                let precoComplementos = 0;

                // Calcular preço dos complementos se existirem
                if (produto.complementos && produto.complementos.length > 0) {
                    const complementos = await prisma.complemento.findMany({
                        where: { id: { in: produto.complementos } }
                    });

                    // Cálculo de preços de complementos (agora funcionará)
                    precoComplementos = complementos.reduce((total, complemento) => {
                        return total + complemento.preco; // Agora preco existe no tipo Complemento
                    }, 0);

                    const precoTotalItem = precoProduto + precoComplementos;
                    valorTotal += precoTotalItem;

                    return {
                        ...produto,
                        preco: precoTotalItem, // Atualiza com preço total (produto + complementos)
                        precoBase: precoProduto,
                        precoComplementos
                    };
                }
            })

        );

        // Criar pedido no banco de dados
        const novoPedido = await prisma.pedido.create({
            data: {
                nomeCliente,
                telefone,
                endereco,
                metodoPagamento,
                status: 'pendente',

                produtos: {
                    create: produtosComPrecos.map(produto => ({
                        produto: { connect: { id: produto.produtoId } },
                        tamanho: produto.tamanho,
                        preco: produto.preco, // Já inclui complementos
                        complementos: {
                            create: produto.complementos?.map((complementoId: Number) => ({
                                complemento: { connect: { id: complementoId } }
                            }))
                        }
                    }))
                }
            },
            include: {
                produtos: {
                    include: {
                        produto: true,
                        complementos: {
                            include: {
                                complemento: true
                            }
                        }
                    }
                }
            }
        });

        res.status(201).json({
            ...novoPedido,
            detalhesPrecos: {
                valorTotal,
                itens: produtosComPrecos.map(p => ({
                    produtoId: p.produtoId,
                    precoBase: p.precoBase,
                    precoComplementos: p.precoComplementos,
                    precoTotal: p.preco
                }))
            }
        });
    } catch (error: unknown) {
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: error
        });
    }
});
export default router;