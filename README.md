# rollup-plugin-conditional-exec

> ⚙️🚀 Execute commands after writing a bundle with optionally provided conditions

[![build](https://github.com/Codex-/rollup-plugin-conditional-exec/actions/workflows/build.yml/badge.svg)](https://github.com/Codex-/rollup-plugin-conditional-exec/actions/workflows/build.yml)
[![codecov](https://codecov.io/gh/Codex-/rollup-plugin-conditional-exec/branch/main/graph/badge.svg?token=WWGNIPC249)](https://codecov.io/gh/Codex-/rollup-plugin-conditional-exec)
[![npm](https://img.shields.io/npm/v/rollup-plugin-conditional-exec.svg)](https://www.npmjs.com/package/rollup-plugin-conditional-exec)

This package facilitates executing a given command after a bundle has been written by Rollup. The timing of the execution of the given command can be leveraged by providing a condition to satisfy before performing the command.

For example, if you are a Vite user and you generate bundled code for `es` & `umd`, you can write a condition function in your `vite.config.ts` that will only return true once both values have been observed, as Vite will run rollup twice to generate both of these.

I built this primarily so that after each successful bundle had been generated, `yalc push` would be called.

## Usage

Create a `rollup.config.js` configuration file and import this plugin:

```ts
import conditionalExec from "rollup-plugin-conditional-exec";

export default {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "cjs",
  },
  plugins: [
    conditionalExec({
      command: "yalc push",
    }),
  ],
};
```

## Options

Typings for the options are available by importing `RollupConditionalExecOptions`.

### `command`

Type: `string`
Required: `true`

This is the command you want to be executed after a bundle has been written.

### `options`

Type: `object`
Default: `{ stdio: "inherit" }`

See [`CommonExecOptions`](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback) for available options.

If an options object is provided, it will override the default.

### `condition`

Type: `() => Promise<boolean> | boolean` | `(outputOpts: OutputOptions) => Promise<boolean> | boolean`
Default: `() => true`

Provide an optional condition to satisfy before a given command is executed. The condition command is passed in the `OutputOptions` that are give to `writeBundle` to allow you to leverage build time specific options. i.e. which bundle you are currently generating in a series of bundling operations.

### `afterExec`

Type: `() => Promise<void> | void`
Default: `() => undefined`

Provide an optional function to be executed after the command has been executed successfully. This can allow you to tidy up state, where you need to reset a state between bundles when running in a build watch mode or similar.

### `onError`

Type: `(error: Error) => Promise<void> | void`
Default:

```ts
(error: Error) => {
  console.error(`Exec has failed: ${error.message}`);
  console.debug(error.stack);
  throw error;
};
```

Provide an optional function to be executed should your provided command fail to execute successfully. By default, this will log your error and then rethrow the error to prevent a silent failure.

## How it works

### This plugin leverages the following hooks provided by Rollup

- Build Hooks
  - [`buildStart`](https://rollupjs.org/guide/en/#buildstart)
    - An assertion is completed here to validate that the command itself is both provided and not an empty string.
- Output Generation Hooks
  - [`writeBundle`](https://rollupjs.org/guide/en/#writebundle)
    - It is at this stage that commands are executed via Nodes `exec` function.

### Simplified Flow of used hooks

```ascii
┌──────────────── Rollup ────────────────┐
│                                        │
│                                        │
│   ┌──────────────┐                     │
│   │  buildStart  │                     │
│   └───────┬──────┘                     │
│           │                            │
│           │                            │
│           ▼                            │
│   ┌──────────────┐                     │
│   │  Assert cmd  │                     │
│   │              ├─── false ──┐        │
│   │  is defined  │            │        │
│   └───────┬──────┘            │        │
│           │                   │        │
│           │                   │        │
│         true                  │        │
│           │                   ▼        │
│           ▼              ┌─────────┐   │
│   ┌───────────────┐      │  Fail   │   │
│   │  writeBundle  │      │         │   │
│   └───────┬───────┘      │  Build  │   │
│           │              └─────────┘   │
│           │                   ▲        │
│           ▼                   │        │
│     ┌───────────┐             │        │
│     │  execute  │             │        │
│     │           ├──── error ──┘        │
│     │  command  │                      │
│     └─────┬─────┘                      │
│           │                            │
│           │                            │
│        success                         │
│           │                            │
│           │                            │
│           ▼                            │
│    ┌─────────────┐                     │
│    │  Completed  │                     │
│    └─────────────┘                     │
│                                        │
│                                        │
└────────────────────────────────────────┘
```
