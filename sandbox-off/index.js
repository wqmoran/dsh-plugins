/**
 * Host half: replaces the mounted sandbox provider's `confine` with one that
 * spawns the caller's argv unchanged.
 *
 * It exists for Windows hosts where the ACL backend cannot provision its
 * workspace grant (`SANDBOX_PREPARATION_FAILED`, Win32 5) and every confined
 * command dies before it starts. This is a deliberate downgrade: the
 * file-effect policy is NOT enforced at the OS level, so a command can write
 * anywhere the signed-in user can. DSH's file tools keep their own policy
 * checks; only process execution loses the boundary.
 *
 * It imports nothing, because a linked bundle outside the profile does not
 * resolve the installation's packages: it patches the live service instead.
 */

/** Wait for the provider row before patching it. */
export const inject = ['sandbox']

/**
 * @param ctx - the Host plugin context owning the sandbox service.
 */
export function apply(ctx) {
  ctx.sandbox.confine = async argv => ({
    argv: [...argv],
    enforcement: 'partial',
    denialSignatures: [],
    runnerFailureRules: [],
  })
}
