/**
 * Host half: one authenticated exact Fetch route that permanently deletes a
 * Session's stored log and its Workspace accounting.
 *
 * The route is reached only by the owner Peer (the browser that opened this
 * Harness), because Connection's shared API channel applies its trust fence
 * and browser-session check before dispatching an exact route.
 */
import { rm } from 'node:fs/promises'
import path from 'node:path'

/** Services this Host half needs; the route activates only where all are mounted. */
export const inject = ['connection', 'sessionPersistence', 'workspaceRegistry', 'agents']

/** Route path on the shared API channel. */
const ROUTE = '/api/session.delete'

/** A Session id must be one safe single-segment identifier. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

/** A canonical log file name, current generation or a historical one. */
const LOG_FILE = /^session(\.v\d+)?\.jsonl(\.zstd)?$/

/** Allowed client-visible failures; the message is what the menu shows. */
const FAILURE = {
  'invalid-body': [400, 'The delete request had no valid JSON body.'],
  'invalid-session-id': [400, 'The Session id in the delete request is not valid.'],
  'session-running': [409, 'This Session is running right now. Stop it before deleting.'],
  'session-file-locked': [409, 'The Session log is still open in another process, so it could not be removed. Close that process and retry.'],
  'unexpected-location': [409, 'The stored log path did not look like a Session log; deletion was aborted.'],
  'internal-error': [500, 'The Host failed while deleting this Session.'],
}

/**
 * @param status - HTTP status.
 * @param body - JSON-compatible payload.
 * @returns one JSON response.
 */
function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * @param code - one {@link FAILURE} key.
 * @returns its response.
 */
function fail(code) {
  const [status, message] = FAILURE[code]
  return reply(status, { error: code, message })
}

/** Windows releases a just-closed handle asynchronously; retry a bounded few times. */
const RETRY_CODES = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY'])

/**
 * Remove one directory, tolerating a short release delay.
 * @param directory - absolute directory to remove.
 */
async function removeDirectory(directory) {
  let last
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true })
      return
    } catch (error) {
      last = error
      if (!RETRY_CODES.has(error?.code)) throw error
      await new Promise(resolve => setTimeout(resolve, 120))
    }
  }
  throw last
}

/**
 * Delete one stored Session: stop its work, remove its log directory, and drop
 * its Workspace accounting.
 *
 * The running Host may keep a live Session object in memory for the rest of the
 * process; nothing else refers to it once its log and accounting are gone, and
 * the next start has no record of it.
 * @param ctx - the plugin context owning the services.
 * @param request - the Buffered POST request.
 * @returns one JSON outcome.
 */
async function deleteSession(ctx, request) {
  try {
    let payload
    try {
      payload = await request.json()
    } catch {
      return fail('invalid-body')
    }
    const sessionId = payload !== null && typeof payload === 'object' ? payload.sessionId : undefined
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return fail('invalid-session-id')

    // The Agent is the authority on running work; the Session store keeps idle
    // entries too, so `sessions.get()` alone cannot answer this.
    const agent = ctx.agents.get(sessionId)
    if (agent !== undefined && agent.status === 'running') return fail('session-running')

    const snapshot = await ctx.sessionPersistence.stat(sessionId)
    let directory
    if (snapshot !== undefined) {
      const logPath = snapshot.location?.path
      if (typeof logPath === 'string' && logPath.length > 0) {
        const candidate = path.dirname(logPath)
        if (!LOG_FILE.test(path.basename(logPath)) || !path.basename(candidate).includes(sessionId)) {
          return fail('unexpected-location')
        }
        directory = candidate
      }
    }

    // Stop whatever the Session still owns (scheduled reminders, background
    // jobs, subagents) before anything is removed. An already archived Session
    // resolves without writing, and one with no stored log is simply skipped.
    try {
      await ctx.workspaceRegistry.archiveSession(sessionId, { stopActivity: true })
    } catch (error) {
      ctx.logger.warn('session-delete: stopping work before deleting %s failed: %s', sessionId, String(error))
    }

    // Accounting first: a crash between these steps then cannot leave a row
    // pointing at a directory that no longer exists.
    const workspace = ctx.workspaceRegistry.list().find(item => item.sessionIds.includes(sessionId))
    if (workspace !== undefined) await workspace.detachSession(sessionId)

    if (directory !== undefined) await removeDirectory(directory)

    if (ctx.get('sessions')?.get(sessionId) !== undefined) {
      ctx.logger.info('session-delete: Session %s is still held in memory until restart', sessionId)
    }
    ctx.logger.info('session-delete: deleted Session %s (%s)', sessionId, directory ?? 'no stored log')
    return reply(200, { sessionId, removed: directory !== undefined })
  } catch (error) {
    ctx.logger.warn('session-delete: deleting a Session failed: %s', String(error))
    return fail('internal-error')
  }
}

/**
 * Register the delete route on the shared API channel.
 * @param ctx - the Host plugin context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: request => deleteSession(ctx, request),
  }), 'session-delete: route')
}
