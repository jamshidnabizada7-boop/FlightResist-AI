import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import fs from 'node:fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma's `file:./db/custom.db` resolves relative to whoever opens it, which is
// three different places in this project:
//   - dev server        → cwd is the project root                      ✓
//   - standalone server  → `server.js` calls `process.chdir(__dirname)`,
//                          so cwd becomes `.next/standalone` and the path
//                          lands on a stale build-time copy of the DB
//   - `prisma` CLI       → resolves relative to `prisma/schema.prisma`
// Anchor every relative path at the real project root so all three agree on the
// single git-tracked `db/custom.db`. Absolute URLs pass through untouched, which
// is what a deployed box should set.
const projectRoot = (() => {
  const cwd = process.cwd()
  // Undo the standalone server's chdir: `<root>/.next/standalone` → `<root>`.
  const standaloneSuffix = path.join('.next', 'standalone')
  return cwd.endsWith(standaloneSuffix) ? path.resolve(cwd, '..', '..') : cwd
})()

const resolvedDbPath = (() => {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  const m = /^file:(\.\.?\/.+)$/.exec(url)
  if (!m) return url // http(s):// or absolute — leave untouched
  const resolved = path.resolve(projectRoot, m[1])
  return `file:${resolved}`
})()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging is a dev aid. In production it emits every statement (and the
    // full schema) to stdout, which floods the server journal on a deployed box.
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query'],
    ...(resolvedDbPath ? { datasources: { db: { url: resolvedDbPath } } } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Check if the SQLite database is available (file exists and is accessible).
 * Returns false on Vercel's ephemeral filesystem where SQLite files don't persist.
 * Use this to gracefully skip DB operations in serverless environments.
 */
let _dbAvailable: boolean | null = null;
export function dbAvailable(): boolean {
  if (_dbAvailable !== null) return _dbAvailable;
  
  // If no DATABASE_URL or it's not a file:// URL, assume unavailable
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('file:')) {
    _dbAvailable = false;
    return false;
  }
  
  // Extract the file path from the URL
  const filePath = url.replace(/^file:/, '');
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(projectRoot, filePath);
  
  try {
    // Check if the file exists and is accessible
    fs.accessSync(absolutePath, fs.constants.R_OK | fs.constants.W_OK);
    _dbAvailable = true;
  } catch {
    _dbAvailable = false;
  }
  
  return _dbAvailable;
}
