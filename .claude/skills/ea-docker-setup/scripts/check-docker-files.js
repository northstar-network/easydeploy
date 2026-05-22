#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const projectRoot = process.cwd();

const composeFile =
  ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"].find(
    (f) => existsSync(join(projectRoot, f))
  ) ?? null;

const result = {
  projectRoot,
  projectName: basename(projectRoot).toLowerCase().replace(/\s+/g, "-"),
  hasDockerfile: existsSync(join(projectRoot, "Dockerfile")),
  hasCompose: composeFile !== null,
  composeFile,
  files: readdirSync(projectRoot).filter((f) => !f.startsWith(".")),
};

process.stdout.write(JSON.stringify(result) + "\n");
