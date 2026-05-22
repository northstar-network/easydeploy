#!/usr/bin/env node
import { run } from "./lib/exec.js";

const docker = await run("docker", ["--version"]);
const compose = await run("docker", ["compose", "version"]);

const result = {
  docker: docker.exitCode === 0,
  dockerVersion: docker.exitCode === 0 ? docker.stdout : null,
  compose: compose.exitCode === 0,
  composeVersion: compose.exitCode === 0 ? compose.stdout : null,
};

if (!result.docker) {
  process.stderr.write("Docker not found in PATH\n");
}
if (result.docker && !result.compose) {
  process.stderr.write("docker compose subcommand not available\n");
}

process.stdout.write(JSON.stringify(result) + "\n");
process.exit(0);
