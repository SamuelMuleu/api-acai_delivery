import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PedidoStatus } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();



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