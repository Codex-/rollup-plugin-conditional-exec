import { join } from "path";
import cp, { ChildProcess, CommonExecOptions } from "child_process";
import { OutputOptions, rollup } from "rollup";
import conditionalExec from "./";

const cwd = join(__dirname, "__fixtures__/");
const outputDir = join(__dirname, "../output");

describe("rollup-plugin-conditional-exec", () => {
  let mockExec: jest.SpyInstance;

  function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  beforeEach(() => {
    jest.spyOn(cp, "ChildProcess").mockImplementation();

    mockExec = jest.spyOn(cp, "exec").mockImplementation((cmd, opts, cb) => {
      cb && cb(null, "", "");
      return new ChildProcess();
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("command", () => {
    it("should execute a given command", async () => {
      const cmd = "hello";

      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: cmd,
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(mockExec).toBeCalledTimes(1);

      const args: any[] = mockExec.mock.calls[0];
      expect(args[0]).toStrictEqual(cmd);
    });

    it("should throw if given an empty command", async () => {
      const bundlePromise = rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "",
          }),
        ],
      });

      await expect(bundlePromise).rejects.toThrow(
        "rollup-plugin-conditional-exec requires a command to be used, received: empty string"
      );
    });
  });

  describe("options", () => {
    it("should pass default options through to exec", async () => {
      const expectedOpts: CommonExecOptions = { stdio: "inherit" };

      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(mockExec).toBeCalledTimes(1);

      const args: any[] = mockExec.mock.calls[0];
      expect(args[1]).toStrictEqual(expectedOpts);
    });

    it("should override options with provided options", async () => {
      const expectedOpts: CommonExecOptions = { maxBuffer: 1024 };

      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            options: expectedOpts,
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(mockExec).toBeCalledTimes(1);

      const args: any[] = mockExec.mock.calls[0];
      expect(args[1]).toStrictEqual(expectedOpts);
    });
  });

  describe("condition", () => {
    it("should execute when a condition hasn't been specified", async () => {
      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(mockExec).toBeCalledTimes(1);
    });

    it("should execute if a provided condition is satisfied", async () => {
      let checked = false;
      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            condition: () => {
              if (!checked) {
                checked = true;
                return false;
              }

              return true;
            },
          }),
        ],
      });

      // Condition fails to satisfy the first time
      await bundle.write({ dir: outputDir, format: "cjs" });
      expect(mockExec).toBeCalledTimes(0);

      // Condition has now been satisfied
      await bundle.write({ dir: outputDir, format: "cjs" });
      expect(mockExec).toBeCalledTimes(1);
    });

    it("should await a condition if it returns a promise", async () => {
      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            // Use false here, if a promise is not awaited, a non-awaited promise is truth.
            // Returning false ensures that we are awaiting the promises resolved value.
            condition: async () => false,
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(mockExec).toBeCalledTimes(0);
    });

    it("should not execute if a condition has not been satisfied", async () => {
      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            condition: () => false,
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(mockExec).toBeCalledTimes(0);
    });

    it("should call the condition function with the OutputOpts for writeBundle", async () => {
      const expectedFormat = "cjs";

      let format: string | undefined;
      const condition = (outputOpts: OutputOptions) => {
        format = outputOpts.format;
        return true;
      };

      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            condition,
          }),
        ],
      });

      await bundle.write({ dir: outputDir, format: expectedFormat });

      expect(format).toStrictEqual(expectedFormat);
    });
  });

  describe("afterExec", () => {
    it("should run a given function after a successful execution", async () => {
      const afterExec = jest.fn();
      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            afterExec,
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(afterExec).toBeCalledTimes(1);
    });

    it("should await an afterExec function if it returns a promise", async () => {
      // Create a function that will await the change of this value to resolve
      let shouldResolve = false;
      const awaitAfterExec = async (): Promise<void> => {
        if (!shouldResolve) {
          await sleep(100);
          return awaitAfterExec();
        }
      };
      const promiseToBeResolved = awaitAfterExec();

      // afterExec can now control the resolution of the previous promise
      const afterExec = async () => {
        shouldResolve = true;
        await promiseToBeResolved;
      };

      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            afterExec,
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      await expect(promiseToBeResolved).resolves.toBeUndefined();
    });
  });

  describe("onError", () => {
    beforeEach(() => {
      mockExec.mockRestore();

      mockExec = jest.spyOn(cp, "exec").mockImplementation((cmd, opts, cb) => {
        cb && cb(new Error("Test Error"), "", "");
        return new ChildProcess();
      });
    });

    it("should log and throw the error if no onError function has been provided", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error");
      const consoleDebugSpy = jest.spyOn(console, "debug");

      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
          }),
        ],
      });

      // await bundle.write({ dir: outputDir, format: "cjs" })
      await expect(
        bundle.write({ dir: outputDir, format: "cjs" })
      ).rejects.toThrow("Test Error");
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it("should call a given onError function should an error occur", async () => {
      const onError = jest.fn();
      const bundle = await rollup({
        input: join(cwd, "index.js"),
        preserveEntrySignatures: "strict",
        plugins: [
          conditionalExec({
            command: "hello",
            onError,
          }),
        ],
      });
      await bundle.write({ dir: outputDir, format: "cjs" });

      expect(onError).toBeCalledTimes(1);
    });
  });
});
