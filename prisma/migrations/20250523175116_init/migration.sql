/*
  Warnings:

  - You are about to drop the column `criado_em` on the `Produto` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ComplementoTipo" AS ENUM ('fruta', 'cobertura', 'adicional');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('pix', 'dinheiro', 'cartao');

-- CreateEnum
CREATE TYPE "PedidoStatus" AS ENUM ('pendente', 'preparo', 'saiu', 'entregue');

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "criado_em",
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Complemento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "ComplementoTipo" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Complemento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "nomeCliente" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "metodoPagamento" "MetodoPagamento" NOT NULL,
    "status" "PedidoStatus" NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoProduto" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "tamanho" TEXT NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PedidoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoComplemento" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "complementoId" INTEGER NOT NULL,

    CONSTRAINT "ProdutoComplemento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoProdutoComplemento" (
    "id" SERIAL NOT NULL,
    "pedidoProdutoId" INTEGER NOT NULL,
    "complementoId" INTEGER NOT NULL,

    CONSTRAINT "PedidoProdutoComplemento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoComplemento" ADD CONSTRAINT "ProdutoComplemento_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoComplemento" ADD CONSTRAINT "ProdutoComplemento_complementoId_fkey" FOREIGN KEY ("complementoId") REFERENCES "Complemento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProdutoComplemento" ADD CONSTRAINT "PedidoProdutoComplemento_pedidoProdutoId_fkey" FOREIGN KEY ("pedidoProdutoId") REFERENCES "PedidoProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProdutoComplemento" ADD CONSTRAINT "PedidoProdutoComplemento_complementoId_fkey" FOREIGN KEY ("complementoId") REFERENCES "Complemento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
