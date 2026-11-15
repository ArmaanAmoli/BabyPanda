/// <reference types="bun" />
/**
 * Builds a standalone BabyPanda executable.
 *
 * Why this exists instead of `bun build --compile src/cli.tsx`:
 *
 * ink's `build/devtools.js` imports `react-devtools-core` at the top level,
 * unconditionally. That module is only ever used to talk to a running React
 * DevTools UI over a WebSocket on localhost:8097 -- if nothing is listening
 * it is a silent no-op -- but because the import is static, every bundler
 * has to resolve it at build time. `react-devtools-core` is only a
 * peerDependency of ink, so it is not installed and the build fails with
 * "Could not resolve".
 *
 * Installing it is not a fix: it depends on `ws@^7`, which evicts the
 * `ws@8` that ink, openai, engine.io and socket.io-adapter all share.
 *
 * So we stub it. The plugin below intercepts the specifier and hands the
 * bundler an empty module instead, which is behaviourally identical for a
 * production binary: the devtools code path never runs.
 */
import {rename} from 'fs/promises';
import path from 'path';

const packageRoot = path.resolve(import.meta.dir, '..');
const entrypoint = path.join(packageRoot, 'src', 'cli.tsx');
const outDir = path.join(packageRoot, 'bin');
const outFile = path.join(outDir, 'babypanda');

/**
 * Replaces `react-devtools-core` with an empty module.
 *
 * `onResolve` claims the specifier and tags it with a private namespace;
 * `onLoad` then supplies the source for anything in that namespace. The
 * namespace is what stops the two hooks from matching each other's output
 * and looping.
 */
const stubReactDevtools: Bun.BunPlugin = {
	name: 'stub-react-devtools',
	setup(builder: Bun.PluginBuilder) {
		builder.onResolve({filter: /^react-devtools-core$/}, () => ({
			path: 'react-devtools-core',
			namespace: 'stub-devtools',
		}));

		builder.onLoad({filter: /.*/, namespace: 'stub-devtools'}, () => ({
			contents: 'export default {};',
			loader: 'js',
		}));
	},
};

const result = await Bun.build({
	entrypoints: [entrypoint],
	compile: true,
	outdir: outDir,
	plugins: [stubReactDevtools],
});

if (!result.success) {
	console.error('Binary build failed:');
	for (const message of result.logs) {
		console.error(`  ${message}`);
	}
	process.exit(1);
}

// Bun names the executable after the entrypoint (`cli`); we want `babypanda`.
await rename(path.join(outDir, 'cli'), outFile);

console.log(`Built ${outFile}`);
