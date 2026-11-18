// VitePress `buildEnd` hook: writes build.json (commit, time, repository) next to the built pages. The published site reads it to show
// a build badge and, with a token, to edit {editable} tables back into the repository (src/theme/publish.mjs). Nothing is written
// into the site's repo; outside CI (no GITHUB_REPOSITORY) the badge stays off.
import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export default function buildInfo(siteConfig) {
  const env = process.env;
  const server = env.GITHUB_SERVER_URL || "https://github.com";
  const info = {
    repo: env.GITHUB_REPOSITORY || null,
    api: server === "https://github.com" ? "https://api.github.com" : `${server}/api/v3`,
    server,
    branch: env.GITHUB_REF_NAME || "main",
    sha: env.GITHUB_SHA || null,
    builtAt: new Date().toISOString(),
    src: relative(process.cwd(), siteConfig.srcDir).split("\\").join("/"),
  };
  writeFileSync(join(siteConfig.outDir, "build.json"), JSON.stringify(info, null, 2));
}
