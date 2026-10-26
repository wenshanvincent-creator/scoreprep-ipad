"""Build the portable desktop runtime from the verified isolated build environment."""
import argparse
import importlib.metadata
import json
from pathlib import Path
import re
import shutil
import sys

from engine import MODELS, REVISION, digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--python-home", required=True, type=Path)
    parser.add_argument("--site-packages", required=True, type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    home, packages = args.python_home.resolve(strict=True), args.site_packages.resolve(strict=True)
    if Path(sys.base_prefix).resolve() != home or sys.version_info[:3] != (3, 12, 14):
        raise RuntimeError("Run packaging with the verified Python 3.12.14 build environment")
    normalize = lambda s: re.sub(r"[-_.]+", "-", s).lower()
    requirements = (Path(__file__).parent / "requirements.txt").read_text(encoding="utf-8").splitlines()
    expected = {normalize(line.split("==")[0]): line.split("==")[1]
                for line in requirements if "==" in line}
    installed = {normalize(d.metadata["Name"]): d for d in importlib.metadata.distributions(path=[str(packages)])}
    if set(installed) != set(expected) | {"homr"}:
        raise RuntimeError("Build environment contains missing or unlisted distributions")
    for name, version in expected.items():
        if installed[name].version != version:
            raise RuntimeError(f"Build dependency version mismatch: {name}")
    origin = json.loads(installed["homr"].read_text("direct_url.json"))
    if origin.get("vcs_info", {}).get("commit_id") != REVISION:
        raise RuntimeError("Build homr revision mismatch")
    for name, sha in MODELS.items():
        if digest(packages / "homr" / name) != sha:
            raise RuntimeError(f"Build model mismatch: {name}")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)

    def ignore(folder, names):
        return {name for name in names if name in {
            "__pycache__", "site-packages", "test", "tests", "idlelib", "tkinter",
            "ensurepip", "_virtualenv.py", "_virtualenv.pth",
        } or name.endswith((".pyc", ".pyo", ".pdb"))}

    python = output / "python"
    python.mkdir()
    for name in ("python.exe", "python3.dll", "python312.dll", "vcruntime140.dll", "vcruntime140_1.dll", "LICENSE.txt"):
        shutil.copyfile(home / name, python / name)
    for name in ("DLLs", "Lib"):
        shutil.copytree(home / name, python / name, ignore=ignore)
    shutil.copytree(packages, python / "Lib" / "site-packages", ignore=ignore)
    for name in ("worker.py", "engine.py", "glyphs.py", "printed_text.py", "requirements.txt"):
        shutil.copyfile(Path(__file__).parent / name, output / name)
    inventory = [{"file": p.relative_to(output).as_posix(), "sha256": digest(p)}
                 for p in sorted(output.rglob("*")) if p.is_file()]
    receipt = dict(python="3.12.14", homrRevision=REVISION,
                   packages={name: d.version for name, d in installed.items()}, files=inventory)
    (output / "runtime-receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(dict(files=len(inventory), output=str(output), python=receipt["python"])))


if __name__ == "__main__":
    main()
