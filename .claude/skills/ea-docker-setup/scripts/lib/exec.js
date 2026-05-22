#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Run a shell command and return stdout, stderr, exitCode.
 * Never throws — caller decides what to do with non-zero exit.
 */
export async function run(cmd, args = [], options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      encoding: "utf8",
      ...options,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (err) {
    return {
      stdout: (err.stdout ?? "").trim(),
      stderr: (err.stderr ?? err.message ?? "").trim(),
      exitCode: err.code ?? 1,
    };
  }
}

/**
 * Run a shell command via /bin/sh -c (for pipes, globs, etc.).
 */
export async function shell(cmd, options = {}) {
  return run("/bin/sh", ["-c", cmd], options);
}
