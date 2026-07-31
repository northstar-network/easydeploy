#!/usr/bin/env python3
"""
Downloads the latest easydeploy skills from GitHub and replaces local skills.
Only skills that exist in the remote repo are updated — other local skills are
left untouched.

Outputs on stdout:
  OLD_VERSION=<x.y.z>
  NEW_VERSION=<x.y.z>
  UPDATED_SKILLS=<skill1,skill2,...>
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO_URL = "https://github.com/northstar-network/easydeploy.git"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILLS_DIR = os.path.dirname(SCRIPT_DIR)  # .claude/skills/


def get_local_version():
    vf = os.path.join(SKILLS_DIR, "easydeploy", "VERSION")
    with open(vf) as f:
        return f.read().strip()


def get_remote_version(remote_dir):
    vf = os.path.join(remote_dir, ".claude", "skills", "easydeploy", "VERSION")
    with open(vf) as f:
        return f.read().strip()


def clone_repo(dest):
    subprocess.run(
        ["git", "clone", "--depth=1", "--quiet", REPO_URL, dest],
        check=True,
        timeout=60,
        capture_output=True,
    )


def update_skills(remote_dir):
    remote_skills = os.path.join(remote_dir, ".claude", "skills")
    updated = []
    for skill_name in sorted(os.listdir(remote_skills)):
        src = os.path.join(remote_skills, skill_name)
        if not os.path.isdir(src):
            continue
        dst = os.path.join(SKILLS_DIR, skill_name)
        shutil.rmtree(dst, ignore_errors=True)
        shutil.copytree(src, dst)
        updated.append(skill_name)
    return updated


def main():
    try:
        old_version = get_local_version()
    except Exception as e:
        print(f"ERROR: cannot read local version: {e}", file=sys.stderr)
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            clone_repo(tmpdir)
        except subprocess.CalledProcessError:
            print("ERROR: git clone failed", file=sys.stderr)
            sys.exit(1)

        try:
            new_version = get_remote_version(tmpdir)
        except Exception as e:
            print(f"ERROR: cannot read remote version: {e}", file=sys.stderr)
            sys.exit(1)

        updated = update_skills(tmpdir)

    print(f"OLD_VERSION={old_version}")
    print(f"NEW_VERSION={new_version}")
    print(f"UPDATED_SKILLS={','.join(updated)}")


if __name__ == "__main__":
    main()
