import { build, emptyDir } from "https://deno.land/x/dnt@0.37.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  scriptModule: false,
  shims: {
    deno: "dev",
  },
  package: {
    name: "@dprint/node-plugin-base",
    version: Deno.args[0],
    description: "Base code for creating dprint Node plugins.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/dprint/node-plugin-base.git",
    },
    bugs: {
      url: "https://github.com/dprint/node-plugin-base/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
  importMap: "./deno.json",
});
