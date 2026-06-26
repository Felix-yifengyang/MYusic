#!/usr/bin/env python3
"""Cut a generated green-screen asset to a transparent PNG."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image


def newest_generated_png() -> Path:
    root = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / "generated_images"
    matches = [path for path in root.rglob("*.png") if path.is_file()]
    if not matches:
        raise SystemExit(f"No generated PNGs found under {root}")
    return max(matches, key=lambda path: path.stat().st_mtime)


def default_helper() -> Path:
    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    return codex_home / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"


def validate_alpha(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    corners = [
        image.getpixel((0, 0))[3],
        image.getpixel((width - 1, 0))[3],
        image.getpixel((0, height - 1))[3],
        image.getpixel((width - 1, height - 1))[3],
    ]
    print(f"mode=RGBA")
    print(f"size={width}x{height}")
    print(f"corner_alpha={','.join(str(value) for value in corners)}")
    if any(value != 0 for value in corners):
        raise SystemExit("Output corners are not fully transparent")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Green-screen source PNG. Defaults to newest generated image.")
    parser.add_argument("--out", type=Path, required=True, help="Output transparent PNG path.")
    parser.add_argument("--helper", type=Path, default=default_helper(), help="Path to remove_chroma_key.py.")
    parser.add_argument("--edge-contract", default=None, help="Optional edge contract value passed to the helper.")
    parser.add_argument("--force", action="store_true", help="Overwrite output if it already exists.")
    args = parser.parse_args()

    source = args.source or newest_generated_png()
    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        str(args.helper),
        "--input",
        str(source),
        "--out",
        str(out),
        "--auto-key",
        "border",
        "--soft-matte",
        "--transparent-threshold",
        "12",
        "--opaque-threshold",
        "220",
        "--despill",
    ]
    if args.edge_contract is not None:
        command += ["--edge-contract", str(args.edge_contract)]
    if args.force:
        command.append("--force")

    subprocess.run(command, check=True)
    validate_alpha(out)
    print(f"source={source}")
    print(f"out={out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
