"""Prepare the pinned native dependency with the observed negative-voice fix.

This fetches source and applies a two-line patch. It never runs a model.
"""
import hashlib
from pathlib import Path
import subprocess


REVISION = "425dd7b6ba26edcecbe345c10b15586d095743d9"
SOURCE_HASH = "8ac7d09a3350247c8c6599e3bb4aaa2c4d582772b3cb2fecd35b9a9ce688ff99"
PATCHED_HASH = "2bef068f92cd28abdf4fe40024060426c7a34ac0c267e00f2508545dcb963a29"
ROOT = Path(__file__).resolve().parents[1]
CHECKOUT = ROOT / "build/dependencies/verovio"
PATCH = ROOT / "tools/patches/verovio-negative-voice.patch"
SOURCE_PATH = "src/hum/humlib.cpp"


def git(*arguments, capture=False, check=True):
    return subprocess.run(
        ["git", "-C", str(CHECKOUT), *arguments], check=check,
        text=True, capture_output=capture,
    )


def source_hash():
    # Git's Windows checkout may use CRLF; the pinned source content uses LF.
    text = (CHECKOUT / SOURCE_PATH).read_text(encoding="utf-8")
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
    if changed - {SOURCE_PATH}:
        raise RuntimeError("The dependency has other tracked changes; they were left unchanged.")
    digest = source_hash()
    if digest == SOURCE_HASH:
        git("apply", "--check", str(PATCH))
        git("apply", str(PATCH))
    elif digest != PATCHED_HASH:
        raise RuntimeError("The Humdrum source differs from the pinned source and supported patch.")
    if source_hash() != PATCHED_HASH:
        raise RuntimeError("The native dependency patch did not produce its expected source hash.")
    print(f"Prepared Verovio {REVISION} with the negative-voice bounds fix.")


if __name__ == "__main__":
    prepare()
