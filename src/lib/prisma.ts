import { PrismaClient } from '@prisma/client';

// Single client for the whole app (each PrismaClient opens its own connection pool)
export const prisma = new PrismaClient();
