"""Prepare the pinned native dependency with the observed import/build fixes.

This fetches source and applies the documented patches. It never runs a model.
"""
import hashlib
from pathlib import Path
import subprocess


REVISION = "425dd7b6ba26edcecbe345c10b15586d095743d9"
ROOT = Path(__file__).resolve().parents[1]
CHECKOUT = ROOT / "build/dependencies/verovio"
PATCHES = {
    "src/hum/humlib.cpp": (
        "verovio-negative-voice.patch",
        "8ac7d09a3350247c8c6599e3bb4aaa2c4d582772b3cb2fecd35b9a9ce688ff99",
        "2bef068f92cd28abdf4fe40024060426c7a34ac0c267e00f2508545dcb963a29",
    ),
    # The published manifest declares a test target with no test-source directory.
    # Local package resolution otherwise claims the library sources as tests.
    "Package.swift": (
        "verovio-local-package.patch",
        "fa619ad3a5cd751eb8f30d3af394bc46059defc46c10f003ca33d2b191b0c8af",
        "74ec904b48154a9838da2554ec1b3243bd7e180a741da57a3f20fe6f12a587a8",
    ),
}


def git(*arguments, capture=False, check=True):
    return subprocess.run(
        ["git", "-C", str(CHECKOUT), *arguments], check=check,
        text=True, capture_output=capture,
    )


def source_hash(relative_path):
    # Git's Windows checkout may use CRLF; the pinned source content uses LF.
    text = (CHECKOUT / relative_path).read_text(encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def prepare():
    if not (CHECKOUT / ".git").is_dir():
        if CHECKOUT.exists() and any(CHECKOUT.iterdir()):
            raise RuntimeError(f"Dependency directory is not an empty Git checkout: {CHECKOUT}")
        CHECKOUT.mkdir(parents=True, exist_ok=True)
        git("init", "--quiet")
        git("remote", "add", "origin", "https://github.com/rism-digital/verovio.git")

    head = git("rev-parse", "--verify", "HEAD", capture=True, check=False)
    if head.returncode:
        git("fetch", "--depth=1", "origin", REVISION)
        git("checkout", "--detach", REVISION)
        head = git("rev-parse", "HEAD", capture=True)
    if head.stdout.strip() != REVISION:
        raise RuntimeError("The existing Verovio checkout is at a different revision; it was left unchanged.")

    changed = set(git("diff", "--name-only", "HEAD", capture=True).stdout.splitlines())
    if changed - PATCHES.keys():
        raise RuntimeError("The dependency has other tracked changes; they were left unchanged.")
    for relative_path, (patch_name, original_hash, patched_hash) in PATCHES.items():
        patch = ROOT / "tools/patches" / patch_name
        digest = source_hash(relative_path)
        if digest == original_hash:
            git("apply", "--check", str(patch))
            git("apply", str(patch))
        elif digest != patched_hash:
            raise RuntimeError(f"{relative_path} differs from the pinned source and supported patch.")
        if source_hash(relative_path) != patched_hash:
            raise RuntimeError(f"The patch did not produce its expected source hash: {relative_path}")
    print(f"Prepared Verovio {REVISION} with the native import and local package fixes.")


if __name__ == "__main__":
    prepare()
