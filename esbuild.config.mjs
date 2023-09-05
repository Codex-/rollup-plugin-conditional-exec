import chalk from "chalk";
import { analyzeMetafile, build } from "esbuild";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, "package.json");

async function getExternals() {
  const packageJson = JSON.parse(await readFile(packageJsonPath));

  return Object.keys(packageJson.peerDependencies);
}

async function bundle(externalDeps, format, outDir) {
  return build({
    entryPoints: ["./src/index.ts"],
    outfile: `${outDir}/index.js`,
    metafile: true,
    bundle: true,
    format: format,
    external: externalDeps,
    platform: "node",
    target: "node18",
    treeShaking: true,
  });
}

(async () => {
  try {
    const startTime = Date.now();
    console.info(
      chalk.bold(
        `🚀 ${chalk.blueBright("rollup-plugin-conditional-exec")} Build\n`,
      ),
    );

    const externalDeps = await getExternals();

    for (const [format, outDir] of [
      ["cjs", "dist/cjs"],
      ["esm", "dist/esm"],
    ]) {
      console.info(chalk.bold(`⚙️ Bundling: ${chalk.greenBright(format)}\n`));
      const result = await bundle(externalDeps, format, outDir);

      const analysis = await analyzeMetafile(result.metafile);
      console.info(`📝 Bundle Analysis:${analysis}`);

      console.info(
        chalk.bold(chalk.greenBright(`✔ Bundling ${format} completed!\n`)),
      );
    }

    console.info(
      `${chalk.bold.green("✔ Bundled package successfully!")} (${
        Date.now() - startTime
      }ms)`,
    );
  } catch (error) {
    console.error(`🧨 ${chalk.red.bold("Failed:")} ${error.message}`);
    console.debug(`📚 ${chalk.blueBright.bold("Stack:")} ${error.stack}`);
    process.exit(1);
  }
})();
