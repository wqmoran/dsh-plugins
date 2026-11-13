/**
 * Client half: an extra row in the Session context menu that permanently
 * deletes the clicked Session after one confirmation step.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-session-delete',
  factory(require) {
    const NS = 'sessionDelete'

    const zh = {
      'menu.delete': '删除会话',
      'confirm': '永久删除会话“{title}”？它的会话日志会从磁盘移除，无法恢复。',
      'confirm.action': '永久删除',
      'done': '已删除会话“{title}”',
      'failed': '删除失败，请重试。',
      'error.session-running': '这个会话正在运行，先停止再删除。',
      'error.session-unknown': '这个会话已经不存在了。',
      'error.session-not-materialized': '这个会话还没有写入磁盘，不需要删除。',
      'error.session-resident': 'Host 仍把这个会话留在内存里，日志没有动。重启 Harness 后再删一次。',
      'error.session-file-locked': '会话日志还被占用，删不掉。关掉占用它的进程再试。',
      'error.unexpected-location': '会话日志路径异常，已中止删除。',
      'error.invalid-body': '删除请求无效。',
      'error.invalid-session-id': '会话 ID 无效。',
      'error.unknown': '删除失败：{message}',
    }

    const en = {
      'menu.delete': 'Delete session',
      'confirm': 'Permanently delete the session “{title}”? Its log is removed from disk and cannot be recovered.',
      'confirm.action': 'Delete permanently',
      'done': 'Deleted the session “{title}”',
      'failed': 'The session could not be deleted. Try again.',
      'error.session-running': 'This session is running. Stop it before deleting.',
      'error.session-unknown': 'This session no longer exists.',
      'error.session-not-materialized': 'This session has no log on disk, so there is nothing to delete.',
      'error.session-resident': 'The Host still holds this session in memory, so its log was left untouched. Restart the Harness and delete it again.',
      'error.session-file-locked': 'The session log is still in use, so it could not be removed. Close the process using it and retry.',
      'error.unexpected-location': 'The session log path was unexpected, so deletion was aborted.',
      'error.invalid-body': 'The delete request was not valid.',
      'error.invalid-session-id': 'The session id was not valid.',
      'error.unknown': 'Deletion failed: {message}',
    }

    return {
      inject: ['contextMenus', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-delete: locale')
        const t = ctx.locale.bind(NS)

        const describe = (code, message) => {
          const key = `error.${code}`
          const known = ['session-running', 'session-unknown', 'session-not-materialized',
            'session-resident', 'session-file-locked', 'unexpected-location', 'invalid-body',
            'invalid-session-id']
          if (known.includes(code)) return t(key)
          return t('error.unknown', { message: message || code || 'unknown' })
        }

        const remove = async (sessionId) => {
          const response = await fetch('api/session.delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })
          const body = await response.json().catch(() => null)
          if (!response.ok) throw new Error(describe(body?.error, body?.message))
          return body ?? {}
        }

        ctx.effect(() => ctx.contextMenus.register({
          id: 'session.delete',
          target: 'session',
          order: 700,
          observe: () => [ctx.locale],
          resolve: target => [{
            id: 'delete',
            label: t('menu.delete'),
            danger: true,
            separatorBefore: true,
            afterContent: true,
            failureLabel: t('failed'),
            run: () => {
              ctx.contextMenus.notify(t('confirm', { title: target.displayTitle }), false, {
                label: t('confirm.action'),
                failureLabel: t('failed'),
                run: async () => {
                  try {
                    await remove(target.sessionId)
                  } catch (error) {
                    ctx.contextMenus.notify(error instanceof Error ? error.message : String(error), false)
                    return
                  }
                  // The Host drops the row from the Workspace projection it already
                  // streams, so no reload is needed to make the Session disappear.
                  ctx.contextMenus.notify(t('done', { title: target.displayTitle }), true)
                },
              })
            },
          }],
        }), 'session-delete: menu')
      },
    }
  },
})
