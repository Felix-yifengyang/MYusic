---
name: transparent-chroma-asset
description: Generate project image assets with the built-in image_gen tool on a pure green chroma-key background, then run the local remove_chroma_key.py helper to convert the green background to alpha and save a transparent PNG. Use when the user asks to create transparent PNG assets, green-screen cutouts, pixel-art/UI/game assets, or specifically mentions image_gen plus remove_chroma_key.py.
---

# Transparent Chroma Asset

Use this skill for the exact two-step asset flow:

1. Generate the source image with the built-in `image_gen` tool on a perfectly flat `#00ff00` background.
2. Run `scripts/cut_chroma_asset.py` to call the local `.codex` `remove_chroma_key.py` helper, save the transparent PNG, and verify alpha.

Do not use the image API/CLI fallback unless the user explicitly asks for it. Do not delete the generated source image.

## Prompt Pattern

Include these constraints in the `image_gen` prompt:

```text
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal.
Constraints: background must be one uniform #00ff00 with no gradients, texture, lighting variation, shadows, reflections, floor plane, wall, or vignette. Do not use #00ff00 anywhere in the subject. No text, no watermark, no logo unless explicitly requested.
```

For MYusic room assets, also specify:

```text
Style/medium: detailed warm pixel art matching cozy retro wooden furniture and turntable room assets, crisp sprite edges.
Composition/framing: centered cutout with generous padding, same slightly top-down front room-camera angle.
```

## Cutout Command

Use the Python executable from `codex_app.load_workspace_dependencies` when available; it includes Pillow. Otherwise use any Python environment that can import `PIL`.

After `image_gen` finishes, save into the output path requested by the user or implied by the current repo/task. Do not hard-code a destination directory in this skill.

```powershell
& '<python from load_workspace_dependencies>' <transparent-chroma-asset>\scripts\cut_chroma_asset.py --out <output-transparent.png> --force
```

If the user names a source file, pass it explicitly:

```powershell
& '<python from load_workspace_dependencies>' <transparent-chroma-asset>\scripts\cut_chroma_asset.py --source <green-source.png> --out <output-transparent.png> --force
```

When `--source` is omitted, the script uses the newest PNG under `%USERPROFILE%\.codex\generated_images`.

## Checks

Before finishing:

- Confirm the output file path.
- Confirm the script reported `mode=RGBA` and corner alpha values of `0`.
- If the source subject still has green spill, rerun once with `--edge-contract 1`.
