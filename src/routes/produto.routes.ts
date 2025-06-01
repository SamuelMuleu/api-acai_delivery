import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import upload from '../config/multer';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

const router = Router();
const prisma = new PrismaClient();

type CloudinaryUploadResult = {
    public_id: string;
    version: number;
    signature: string;
    width: number;
    height: number;
    format: string;
    resource_type: string;
    created_at: string;
    tags: string[];
    bytes: number;
    type: string;
    etag: string;
    url: string;
    secure_url: string;
};


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


/**
 * @swagger
 * /produtos:
 *   get:
 *     summary: Retorna todos os produtos
 *     tags: [Produtos]
 *     responses:
 *       200:
 *         description: Lista de produtos retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get('/', async (_, res) => {
    try {
        const produtos = await prisma.produto.findMany({
            include: {
                complementos: {
                    include: {
                        complemento: true
                    }
                }
            },
            orderBy: {
                criadoEm: 'desc'
            }
        });


        const produtosFormatados = produtos.map((produto:any ) => ({
            ...produto,
            tamanhos: produto.tamanhos as Array<{ tamanho: string; preco: number }>
        }));

        res.json(produtosFormatados);
    } catch (error: unknown) {
        console.error('Erro ao buscar produtos:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        res.status(500).json({
            error: 'Erro ao buscar produtos',
            details: errorMessage
        });
    }
});



/**
 * @swagger
 * /produtos/{id}:
 *   get:
 *     summary: Retorna um produto pelo ID
 *     tags: [Produtos]
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID do produto
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Produto encontrado
 *       404:
 *         description: Produto não encontrado
 */
router.get('/:id', async (req, res): Promise<any> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
    }

    try {
        const produto = await prisma.produto.findUnique({
            where: { id },
            include: {
                complementos: {
                    include: {
                        complemento: true
                    }
                }
            }
        });

        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }


        produto.tamanhos = produto.tamanhos as Array<{ tamanho: string; preco: number }>;

        res.json(produto);
    } catch (error) {
        console.error('Erro ao buscar produto por ID:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
})



/**
 * @swagger
 * /produtos:
 *   post:
 *     summary: Cria um novo produto
 *     tags: [Produtos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: Açaí Tropical
 *               descricao:
 *                 type: string
 *                 example: Açaí com granola e frutas
 *               tamanhos:
 *                 type: string
 *                 example: '[{"nome": "Pequeno", "preco": 10.0}]'
 *               imagem:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 *       400:
 *         description: Erro de validação nos dados enviados
 */

router.post('/', upload.single('imagem'), async (req, res): Promise<any> => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Imagem é obrigatória' });
        }

        const { nome, descricao, tamanhos } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
        if (!tamanhos) return res.status(400).json({ error: 'Tamanhos são obrigatórios' });

        let tamanhosArray;
        try {
            tamanhosArray = JSON.parse(tamanhos);
            if (!Array.isArray(tamanhosArray)) throw new Error('Formato inválido');
        } catch {
            return res.status(400).json({ error: 'Formato de tamanhos inválido' });
        }

        const tamanhosInvalidos = tamanhosArray.some(t =>
            !t.nome || typeof t.nome !== 'string' ||
            typeof t.preco !== 'number' || isNaN(t.preco)
        );
        if (tamanhosInvalidos) return res.status(400).json({ error: 'Dados de tamanhos inválidos' });

        // Upload para Cloudinary usando buffer do multer
        const uploadResult = await cloudinary.uploader.upload_stream(
            { folder: 'produtos' },
            (error, result) => {
                if (error) throw error;
                return result;
            }
        );


        const streamUpload = (fileBuffer: Buffer): Promise<CloudinaryUploadResult> => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'produtos' },
                    (error, result) => {
                        if (error) return reject(error);
                        if (!result) return reject(new Error('Upload retornou nulo'));


                        resolve(result as CloudinaryUploadResult);
                    }
                );
                stream.end(fileBuffer);
            });
        };


        const result = await streamUpload(req.file.buffer);
        const novoProduto = await prisma.produto.create({
            data: {
                nome,
                descricao,
                imagem: result.secure_url,
                tamanhos: tamanhosArray,
            },
        });

        res.status(201).json(novoProduto);
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});





/**
 * @swagger
 * /produtos/{id}:
 *   delete:
 *     summary: Remove um produto
 *     tags: [Produtos]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do produto a ser removido
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Produto excluído com sucesso
 *       404:
 *         description: Produto não encontrado
 */
router.delete('/:id', async (req, res): Promise<any> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
    }
    try {
        const produto = await prisma.produto.delete({
            where: { id },
        });

        if (produto.imagem) {
            const imagemPath = `public${produto.imagem}`;
            if (fs.existsSync(imagemPath)) {
                fs.unlinkSync(imagemPath);
            }
        }

        res.json(produto);
    } catch (error) {
        console.error('Erro ao excluir produto:', error);

        if (error instanceof Error) {
            return res.status(500).json({ error: error.message });
        } else {
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

});



/**
 * @swagger
 * /produtos/{id}:
 *   put:
 *     summary: Atualiza um produto existente
 *     tags: [Produtos]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do produto
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               descricao:
 *                 type: string
 *               tamanhos:
 *                 type: string
 *                 example: '[{"nome":"Médio","preco":12.0}]'
 *               imagem:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Produto atualizado com sucesso
 *       404:
 *         description: Produto não encontrado
 */

router.put('/:id', upload.single('imagem'), async (req, res): Promise<any> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
    }
    try {
        const produtoAtual = await prisma.produto.findUnique({ where: { id }, });

        if (!produtoAtual) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const { nome, descricao, tamanhos } = req.body;
        let tamanhosArray;
        if (tamanhos) {
            try {
                tamanhosArray = JSON.parse(tamanhos);
            } catch {
                return res.status(400).json({ error: 'Formato de tamanhos inválido' });
            }
        }


        const dadosAtualizados: any = {};
        if (nome) dadosAtualizados.nome = nome;
        if (descricao) dadosAtualizados.descricao = descricao;
        if (tamanhosArray) dadosAtualizados.tamanhos = tamanhosArray;

        if (req.file) {

            dadosAtualizados.imagem = req.file.path;


            if (produtoAtual.imagem) {
                const imagemPath = `public${produtoAtual.imagem}`;
                if (fs.existsSync(imagemPath)) {
                    fs.unlinkSync(imagemPath);
                }
            }
        }

        const produtoAtualizado = await prisma.produto.update({
            where: { id },
            data: dadosAtualizados
        });

        res.json(produtoAtualizado);
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;
