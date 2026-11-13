# dsh-plugins

Plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Plugins

| Plugin | What it does |
| --- | --- |
| [`session-delete`](session-delete) | Adds **Delete session** to the session context menu and permanently removes that session's stored log and workspace accounting. |

## Install

Requires a DSH profile with the plugin manager (Desktop or Web). In **Plugins → Add plugin**, or with the CLI:

```sh
dsh plugin --profile desktop add "github:wqmoran/dsh-plugins#path:/session-delete"
```

Pin a commit so the same version is reproducible:

```sh
dsh plugin --profile desktop add "github:wqmoran/dsh-plugins#<40-character-sha>&path:/session-delete"
```

Only a spec pinned to a full commit can be updated from **Plugins**; a spec on a branch is changed by uninstalling and reinstalling.

## Development

Each directory is a standalone package with its own `package.json`, bundle patch, locales, and icon; there is no aggregate bundle.

Install a working copy by absolute path, which links the checkout instead of copying it:

```sh
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-plugins/session-delete"
```

Do not install the same package name both from a link and from Git: replacing one with the other makes pnpm delete the link target's contents, including source files that only existed there.
