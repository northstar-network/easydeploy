#!/usr/bin/env python3
import os
import sys
import urllib.request

VERSION_URL = (
    "https://raw.githubusercontent.com/northstar-network/easydeploy/"
    "master/.claude/skills/easydeploy/VERSION"
)
TIMEOUT = 5


def get_local_version():
    version_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "VERSION")
    with open(version_file) as f:
        return f.read().strip()


def parse_semver(v):
    return tuple(int(x) for x in v.split("."))


def get_remote_version():
    with urllib.request.urlopen(VERSION_URL, timeout=TIMEOUT) as resp:
        return resp.read().decode().strip()


def main():
    try:
        local = get_local_version()
    except Exception:
        sys.exit(0)

    try:
        remote = get_remote_version()
    except Exception:
        sys.exit(0)

    if parse_semver(local) < parse_semver(remote):
        print(f"UPDATE_NEEDED:{local}:{remote}")
        sys.exit(1)


if __name__ == "__main__":
    main()
