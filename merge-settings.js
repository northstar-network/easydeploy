#!/usr/bin/env node
/**
 * Merges permissions.allow from source settings into target settings.
 * Usage: node merge-settings.js <source.json> <target.json>
 * Writes result to target.json in-place.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [, , src, dst] = process.argv;
if (!src || !dst) {
  process.stderr.write("Usage: node merge-settings.js <source.json> <target.json>\n");
  process.exit(2);
}

let source;
try {
  source = JSON.parse(readFileSync(src, "utf8"));
} catch {
  process.stderr.write(`Failed to parse source file: ${src}\n`);
  process.exit(1);
}

let target = {};
if (existsSync(dst)) {
  try {
    target = JSON.parse(readFileSync(dst, "utf8"));
  } catch {
    process.stderr.write(`Failed to parse target file: ${dst}\n`);
    process.exit(1);
  }
}

const srcAllow = source?.permissions?.allow ?? [];
const dstAllow = target?.permissions?.allow ?? [];
const merged = [...new Set([...dstAllow, ...srcAllow])];

target.permissions ??= {};
target.permissions.allow = merged;

writeFileSync(dst, JSON.stringify(target, null, 2) + "\n");
process.stdout.write(`Merged ${srcAllow.length} permission(s) into ${dst}\n`);
