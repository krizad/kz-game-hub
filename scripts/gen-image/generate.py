#!/usr/bin/env python3
"""
KZ Game Hub - Image Generator (Flux Schnell / ComfyUI)
Python implementation with zero third-party dependencies (pure standard library).
"""

import argparse
import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

DEFAULT_URL = os.environ.get(
    "COMFYUI_URL", "https://duck-rather-mature-plus.trycloudflare.com"
).rstrip("/")
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_WORKFLOW = BASE_DIR / "flux-workflow.json"
DEFAULT_OUTPUT_DIR = BASE_DIR / "output"


def prepare_workflow(raw_workflow, args):
    workflow = json.loads(json.dumps(raw_workflow))

    ksampler = None
    latent = None
    save_image = None
    prompt_node = None
    negative_node = None

    for node_id, node in workflow.items():
        ctype = node.get("class_type")
        if ctype == "KSampler":
            ksampler = node
        elif ctype == "EmptyLatentImage":
            latent = node
        elif ctype == "SaveImage":
            save_image = node

    if ksampler:
        pos_id = ksampler.get("inputs", {}).get("positive", [None])[0]
        if pos_id and str(pos_id) in workflow:
            prompt_node = workflow[str(pos_id)]

        neg_id = ksampler.get("inputs", {}).get("negative", [None])[0]
        if neg_id and str(neg_id) in workflow:
            negative_node = workflow[str(neg_id)]

    if not prompt_node and "6" in workflow:
        prompt_node = workflow["6"]
    if not negative_node and "7" in workflow:
        negative_node = workflow["7"]

    # Positive prompt
    if args.prompt is not None and prompt_node:
        prompt_node["inputs"]["text"] = args.prompt

    # Negative prompt
    if args.negative is not None and negative_node:
        negative_node["inputs"]["text"] = args.negative

    # Seed
    seed = (
        args.seed
        if args.seed is not None
        else random.randint(100000000000000, 999999999999999)
    )
    if ksampler:
        ksampler["inputs"]["seed"] = seed
        if args.steps is not None:
            ksampler["inputs"]["steps"] = args.steps
        if args.cfg is not None:
            ksampler["inputs"]["cfg"] = args.cfg

    # Dimensions
    if latent:
        if args.width is not None:
            latent["inputs"]["width"] = args.width
        if args.height is not None:
            latent["inputs"]["height"] = args.height

    if save_image:
        save_image["inputs"]["filename_prefix"] = "Flux_KZ"

    metadata = {
        "prompt": prompt_node.get("inputs", {}).get("text", "") if prompt_node else "",
        "negative": negative_node.get("inputs", {}).get("text", "") if negative_node else "",
        "seed": seed,
        "steps": ksampler.get("inputs", {}).get("steps") if ksampler else None,
        "cfg": ksampler.get("inputs", {}).get("cfg") if ksampler else None,
        "width": latent.get("inputs", {}).get("width") if latent else None,
        "height": latent.get("inputs", {}).get("height") if latent else None,
    }

    return workflow, metadata


def generate_image(args):
    base_url = args.url.rstrip("/")
    workflow_path = Path(args.workflow)

    if not workflow_path.exists():
        raise FileNotFoundError(f"Workflow file not found: {workflow_path}")

    with open(workflow_path, "r", encoding="utf-8") as f:
        raw_workflow = json.load(f)

    workflow, metadata = prepare_workflow(raw_workflow, args)

    print(f"\n🚀 Connecting to ComfyUI at: {base_url}")
    print(f"📝 Prompt: \"{metadata['prompt']}\"")
    if metadata["negative"]:
        print(f"🚫 Negative: \"{metadata['negative']}\"")
    print(
        f"📐 Size: {metadata['width']}x{metadata['height']} | Steps: {metadata['steps']} | CFG: {metadata['cfg']} | Seed: {metadata['seed']}\n"
    )

    client_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode("utf-8")

    sys.stdout.write("⏳ Submitting generation task to ComfyUI queue... ")
    sys.stdout.flush()

    req = urllib.request.Request(
        f"{base_url}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        submit_data = json.loads(resp.read().decode("utf-8"))

    prompt_id = submit_data.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"No prompt_id returned: {submit_data}")
    print(f"Done! (Prompt ID: {prompt_id})")

    # Polling
    start_time = time.time()
    image_outputs = []
    dots = 0

    while True:
        time.sleep(1.2)
        elapsed = int(time.time() - start_time)

        try:
            req = urllib.request.Request(f"{base_url}/history/{prompt_id}")
            with urllib.request.urlopen(req) as resp:
                history_data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            continue

        result = history_data.get(prompt_id)
        if result:
            if result.get("status", {}).get("status_str") == "error":
                print()
                raise RuntimeError(f"ComfyUI generation error: {result.get('status')}")

            outputs = result.get("outputs", {})
            for node_out in outputs.values():
                if "images" in node_out and isinstance(node_out["images"], list):
                    image_outputs.extend(node_out["images"])

            if image_outputs:
                sys.stdout.write(f"\r✨ Generation completed in {elapsed}s!                     \n")
                sys.stdout.flush()
                break

        dots = (dots + 1) % 4
        dot_str = ("." * dots).ljust(3)
        sys.stdout.write(f"\r⚙️  Rendering image on GPU{dot_str} ({elapsed}s elapsed)")
        sys.stdout.flush()

    # Download
    output_target = Path(args.output)
    is_explicit_file = output_target.suffix.lower() in [".png", ".jpg", ".webp"]

    if is_explicit_file:
        output_dir = output_target.parent
    else:
        output_dir = output_target

    output_dir.mkdir(parents=True, exist_ok=True)
    saved_files = []

    for i, img_info in enumerate(image_outputs):
        params = {
            "filename": img_info.get("filename", ""),
            "subfolder": img_info.get("subfolder", ""),
            "type": img_info.get("type", "output"),
        }
        view_url = f"{base_url}/view?{urllib.parse.urlencode(params)}"
        print(f"📥 Downloading: {img_info.get('filename')}")

        req = urllib.request.Request(view_url)
        with urllib.request.urlopen(req) as resp:
            img_data = resp.read()

        if is_explicit_file and len(image_outputs) == 1:
            final_path = output_target
        else:
            timestamp = time.strftime("%Y-%m-%dT%H-%M-%S")
            filename = f"{timestamp}_seed{metadata['seed']}_{img_info.get('filename')}"
            final_path = output_dir / filename

        with open(final_path, "wb") as f:
            f.write(img_data)
        saved_files.append(final_path)

        if not args.no_meta:
            meta_path = final_path.with_suffix(".json")
            meta_data = {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "promptId": prompt_id,
                "endpoint": base_url,
                "comfyImage": img_info,
                **metadata,
            }
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta_data, f, indent=2)

    print(f"\n🎉 Success! Saved {len(saved_files)} image(s):")
    for p in saved_files:
        print(f"📁 {p.resolve()}")

    return saved_files


def main():
    parser = argparse.ArgumentParser(
        description="KZ Game Hub - ComfyUI Image Generator (Flux Schnell)"
    )
    parser.add_argument("-p", "--prompt", type=str, help="Positive prompt text")
    parser.add_argument("-n", "--negative", type=str, help="Negative prompt text")
    parser.add_argument("-w", "--width", type=int, help="Image width (default: 1024)")
    parser.add_argument("-H", "--height", type=int, help="Image height (default: 1024)")
    parser.add_argument("--steps", type=int, help="Sampling steps (default: 4)")
    parser.add_argument("--cfg", type=float, help="CFG scale (default: 1.0)")
    parser.add_argument("-s", "--seed", type=int, help="Random seed (default: random)")
    parser.add_argument("-u", "--url", type=str, default=DEFAULT_URL, help="ComfyUI URL")
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT_DIR),
        help="Output dir or filename",
    )
    parser.add_argument(
        "--workflow",
        type=str,
        default=str(DEFAULT_WORKFLOW),
        help="Path to workflow JSON",
    )
    parser.add_argument(
        "--no-meta",
        action="store_true",
        help="Do not save companion .json metadata",
    )

    args = parser.parse_args()

    try:
        generate_image(args)
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
