import { Router } from 'express';
import { PrismaClient } from '@prisma/client';


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
                }}
        });
        res.json(pedidos);
    } catch (error: unknown) {
        console.error('Erro ao buscar pedidos:', error);
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

        if (!nomeCliente || !telefone || !endereco || !metodoPagamento || !produtos || !Array.isArray(produtos) || produtos.length === 0) {
            return res.status(400).json({ error: 'Dados incompletos ou inválidos para o pedido.' });
        }

        let valorTotal = 0;
        const produtosComPrecos = await Promise.all(
            produtos.map(async (produtoReqItem: any) => {
                if (!produtoReqItem || typeof produtoReqItem.produtoId !== 'number' || typeof produtoReqItem.tamanho !== 'string') {
                    throw new Error('Item de produto inválido na requisição.');
                }

                const produtoInfo = await prisma.produto.findUnique({
                    where: { id: produtoReqItem.produtoId }
                });

                if (!produtoInfo) {
                    throw new Error(`Produto com ID ${produtoReqItem.produtoId} não encontrado.`);
                }


                const tamanhosArray = produtoInfo.tamanhos as unknown as Array<{
                    nome: string;
                    preco: number;
                }>;

                const tamanhoSelecionado = tamanhosArray.find(t => t.nome === produtoReqItem.tamanho);

                if (!tamanhoSelecionado) {
                    console.error(`Tamanho "${produtoReqItem.tamanho}" não encontrado para produto ID ${produtoReqItem.produtoId}. Tamanhos disponíveis no BD:`, tamanhosArray);
                    throw new Error(`Tamanho "${produtoReqItem.tamanho}" não disponível para o produto "${produtoInfo.nome}".`);
                }

                let precoProdutoBase = tamanhoSelecionado.preco;
                let precoTotalComplementos = 0;

                if (produtoReqItem.complementos && Array.isArray(produtoReqItem.complementos) && produtoReqItem.complementos.length > 0) {
                    const complementosIds = produtoReqItem.complementos.filter((id: any) => typeof id === 'number');
                    if (complementosIds.length !== produtoReqItem.complementos.length) {
                        throw new Error('Array de complementos contém IDs inválidos.');
                    }

                    const complementosInfo = await prisma.complemento.findMany({
                        where: { id: { in: complementosIds } }
                    });

                    if (complementosInfo.length !== complementosIds.length) {
                        const foundIds = complementosInfo.map((c:any) => c.id);
                        const notFoundIds = complementosIds.filter((id: number) => !foundIds.includes(id));
                        throw new Error(`Complemento(s) com ID(s) ${notFoundIds.join(', ')} não encontrado(s).`);
                    }

                    precoTotalComplementos = complementosInfo.reduce((total:any, complemento:any) => {
                        return total + complemento.preco;
                    }, 0);
                }

                const precoFinalItem = precoProdutoBase + precoTotalComplementos;
                valorTotal += precoFinalItem;

                return {
                    produtoId: produtoReqItem.produtoId,
                    tamanho: produtoReqItem.tamanho,
                    complementos: produtoReqItem.complementos?.filter((id: any) => typeof id === 'number') || [],
                    preco: precoFinalItem,
                    precoBase: precoProdutoBase,
                    precoComplementos: precoTotalComplementos
                };
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
                    create: produtosComPrecos.map(produtoProcessado => ({
                        produto: { connect: { id: produtoProcessado.produtoId } },
                        tamanho: produtoProcessado.tamanho,
                        preco: produtoProcessado.preco,
                        complementos: {
                            create: produtoProcessado.complementos?.map((complementoId: number) => ({
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
                    // nomeProduto
                    precoBase: p.precoBase,
                    precoComplementos: p.precoComplementos,
                    precoTotal: p.preco
                }))
            }
        });
    } catch (error: unknown) {
        console.error('Erro ao criar pedido:', error);
        const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: message
        });
    }
});
export default router;