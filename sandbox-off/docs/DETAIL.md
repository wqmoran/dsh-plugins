# Sandbox off

Replaces the `sandbox` row with a provider that spawns the caller's argv
unchanged. Install it on a Windows host where the ACL backend refuses to
provision:

```text
sandbox-local: windows-acl workspace grant failed: Win32Error: SetNamedSecurityInfoW failed (Win32 5)
```

## What it changes

The ACL backend adds a capability-SID allow entry, a deny entry, and a Low
integrity label to the workspace directory in one `SetNamedSecurityInfoW`
call. A normal account cannot complete that call on every volume, and the
command is then never started. This bundle disables that row and supplies
`ctx.sandbox` itself.

## What you give up

**File-effect confinement is gone.** Under `workspace-write` a shell command
can now read and write anything the signed-in user can reach — other projects,
`~/.dsh`, the whole profile. DSH's file tools (`read`, `write`, `edit`) still
apply their own policy checks; only process execution loses the boundary.

The provider reports `enforcement: partial`, so nothing claims `full`.

## Revert

Disable this bundle in **Plugins** and switch the `sandbox` row back on. No
files, permissions, or profile settings are modified by this bundle; it only
changes which provider answers `ctx.sandbox`.
