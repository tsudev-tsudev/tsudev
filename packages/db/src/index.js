'use strict'
// Shared Prisma client singleton for all tsudev services.
// Avoids exhausting DB connections during dev hot-reload.
const { PrismaClient } = require('@prisma/client')

const globalForPrisma = globalThis
const prisma =
  globalForPrisma.__tsudevPrisma ||
  new PrismaClient({
    log: process.env.PRISMA_LOG ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__tsudevPrisma = prisma
}

module.exports = { prisma, PrismaClient }
module.exports.default = prisma
