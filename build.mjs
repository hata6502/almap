import * as esbuild from "esbuild";

await Promise.all(
  [
    { entryPoints: ["src/index.tsx"], outfile: "docs/index.js" },
    { entryPoints: ["src/memory.ts"], outfile: "docs/memory.js" },
    { entryPoints: ["src/serviceWorker.ts"], outfile: "docs/serviceWorker.js" },
  ].map((options) =>
    esbuild.build({
      ...options,
      bundle: true,
      define: {
        "process.env.TIMESTAMP": JSON.stringify(String(Date.now())),
      },
      format: "esm",
    })
  )
);
