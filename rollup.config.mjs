import { defineConfig } from "rollup";

import babelPlugin from "@rollup/plugin-babel";
import postcssPlugin from "rollup-plugin-postcss";
import replacePlugin from "@rollup/plugin-replace";
import resolvePlugin from "@rollup/plugin-node-resolve";
import commonjsPlugin from "@rollup/plugin-commonjs";
import jsonPlugin from "@rollup/plugin-json";
import userscript from "rollup-plugin-userscript";

import { readPackageUp } from "read-package-up";
const { packageJson } = await readPackageUp();

import { isAbsolute, relative, resolve } from "path";

export default defineConfig([
  {
    input: "src/index.ts",
    plugins: [
      postcssPlugin({
        inject: false,
        minimize: true,
      }),
      babelPlugin({
        babelHelpers: "runtime",
        plugins: [
          [
            import.meta.resolve("@babel/plugin-transform-runtime"),
            {
              useESModules: true,
              version: "^7.5.0",
            },
          ],
        ],
        exclude: "node_modules/**",
        extensions: [".ts", ".tsx", ".mjs", ".js", ".jsx"],
      }),
      replacePlugin({
        values: {
          "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
        },
        preventAssignment: true,
      }),
      resolvePlugin({
        browser: false,
        extensions: [".ts", ".tsx", ".mjs", ".js", ".jsx"],
      }),
      commonjsPlugin(),
      jsonPlugin(),
      userscript((meta) => {
				const authors = [
					packageJson.author?.name,
					...(packageJson.contributors?.map((contributor) => typeof contributor === 'string' ? contributor : contributor.name) ?? [])
				].filter((authorName) => typeof authorName === 'string' && authorName !== '').join(', ');

				return meta
          .replace("process.env.AUTHOR", authors)
          .replace("process.env.VERSION", packageJson.version)
          .replace("process.env.LICENSE", packageJson.license)
			}),
    ],
    external: defineExternal([
      "solid-js",
      "solid-js/web",
			"internet-roadtrip-framework",
			"three",
			"three/examples/jsm/loaders/GLTFLoader"
    ]),
    output: {
      format: "iife",
      file: `dist/InternetRoadtripPano.user.js`,
      globals: {
        "solid-js": "VM.solid",
        "solid-js/web": "VM.solid.web",
        "internet-roadtrip-framework": "IRF",
				"three": "THREE",
				"three/examples/jsm/loaders/GLTFLoader": "THREE"
      },
      indent: false,
    },
  },
]);

function defineExternal(externals) {
  return (id) =>
    externals.some((pattern) => {
      if (typeof pattern === "function") return pattern(id);
      if (pattern && typeof pattern.test === "function")
        return pattern.test(id);
      if (isAbsolute(pattern))
        return !relative(pattern, resolve(id)).startsWith("..");
      return id === pattern || id.startsWith(pattern + "/");
    });
}
