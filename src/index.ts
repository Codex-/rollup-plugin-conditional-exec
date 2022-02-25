import { exec, CommonExecOptions } from "child_process";
import { OutputOptions, Plugin } from "rollup";

export interface RollupConditionalExecOptions {
  command: string;

  /**
   * Override the options object provided to `exec`.
   */
  options?: CommonExecOptions;

  /**
   * A condition to satisfy before running a given command.
   *
   * The `OutputOptions` provided to `generateBundle` are passed in to give more
   * options when determining conditions to satisfy.
   */
  condition?:
    | (() => Promise<boolean> | boolean)
    | ((outputOpts: OutputOptions) => Promise<boolean> | boolean);

  /**
   * This can be used to clean up state, if you have a condition that needs
   * to be reset after a bundle compilation.
   */
  afterExec?: () => Promise<void> | void;

  /**
   * Called when exec throws an error.
   */
  onError?: (error: Error) => Promise<void> | void;
}

export default function conditionalExec(
  opts: RollupConditionalExecOptions
): Plugin {
  const cmd: string = opts.command;
  const options: CommonExecOptions = opts.options || { stdio: "inherit" };
  const condition = opts.condition || (() => true);
  const afterExec = opts.afterExec || (() => undefined);
  const onError =
    opts.onError ||
    ((error: Error) => {
      // eslint-disable-next-line no-console
      console.error(`Exec has failed: ${error.message}`);
      // eslint-disable-next-line no-console
      console.debug(error.stack);

      // Do not hide errors by default
      throw error;
    });

  return {
    name: "conditional-exec",

    buildStart() {
      if (!cmd) {
        const errReason = cmd === "" ? "empty string" : "undefined or null";
        throw new Error(
          `rollup-plugin-conditional-exec requires a command to be used, received: ${errReason}`
        );
      }
    },

    writeBundle: async (outputOptions) => {
      if (await condition(outputOptions)) {
        const cmdPromise = new Promise<void>((resolve, reject) => {
          exec(cmd, options, (error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        });

        try {
          await cmdPromise;
          await afterExec();
        } catch (error) {
          if (error instanceof Error) {
            await onError(error);
          }
        }
      }
    },
  };
}
