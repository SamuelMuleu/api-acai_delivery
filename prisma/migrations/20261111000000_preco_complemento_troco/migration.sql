-- Columns present in schema.prisma but missing from the previous migrations.
-- IF NOT EXISTS keeps this safe for databases that were synced with `prisma db push`.
ALTER TABLE "Complemento" ADD COLUMN IF NOT EXISTS "preco" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "trocoPara" DOUBLE PRECISION;
