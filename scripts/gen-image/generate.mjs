#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default configuration
const DEFAULT_URL = process.env.COMFYUI_URL || 'https://duck-rather-mature-plus.trycloudflare.com';
const DEFAULT_WORKFLOW = resolve(__dirname, 'flux-workflow.json');
const DEFAULT_OUTPUT_DIR = resolve(__dirname, 'output');

function printHelp() {
  console.log(`
🎨 KZ Game Hub - Image Generator (Flux Schnell / ComfyUI)

Usage:
  node scripts/gen-image/generate.mjs [options]
  pnpm gen:image -- [options]

Options:
  -p, --prompt <text>        Positive prompt text
  -n, --negative <text>      Negative prompt text (optional)
  -c, --card <id|num|name>   Generate Dog Relay character card (e.g. dog-001, 1, chef, หมาหมอ)
  --list-cards               List all 30 Dog Relay character cards
  -i, --image <path>         Base image path for image-to-image (img2img)
  --base                     Use Dog Relay dog-base.png as base image reference
  --denoise <0.0-1.0>        Denoising strength for img2img (default: 0.85, higher = more new details)
  -w, --width <pixels>       Image width (default: 1024, ignored if base image used)
  -H, --height <pixels>      Image height (default: 1024, ignored if base image used)
  --steps <count>            Inference steps (default: 4 for Flux Schnell)
  --cfg <scale>              CFG scale (default: 1.0)
  -s, --seed <number>        Random seed (default: random)
  -u, --url <url>            ComfyUI endpoint URL
                             (default: https://duck-rather-mature-plus.trycloudflare.com)
  -o, --output <dir|file>    Output directory or specific image filepath
                             (default: scripts/gen-image/output/)
  --workflow <path>          Path to workflow JSON file (default: flux-workflow.json)
  --no-meta                  Do not write companion .json metadata file
  -h, --help                 Show this help message

Examples:
  pnpm gen:image --card chef --base
  pnpm gen:image --card dog-003 -i ./apps/web/public/images/who-barks/base/dog-base.png --denoise 0.85
  pnpm gen:image -p "A cute golden retriever wearing astronaut suit" --base
  pnpm gen:image --list-cards
`);
}

function parseArgs(args) {
  const options = {
    url: DEFAULT_URL,
    workflowPath: DEFAULT_WORKFLOW,
    output: DEFAULT_OUTPUT_DIR,
    saveMeta: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-p':
      case '--prompt':
        options.prompt = args[++i];
        break;
      case '-n':
      case '--negative':
        options.negative = args[++i];
        break;
      case '-w':
      case '--width':
        options.width = parseInt(args[++i], 10);
        break;
      case '-H':
      case '--height':
        options.height = parseInt(args[++i], 10);
        break;
      case '--steps':
        options.steps = parseInt(args[++i], 10);
        break;
      case '--cfg':
        options.cfg = parseFloat(args[++i]);
        break;
      case '-s':
      case '--seed':
        options.seed = args[++i] === 'random' ? undefined : Number(args[i]);
        break;
      case '-c':
      case '--card':
        options.card = args[++i];
        break;
      case '--list-cards':
        options.listCards = true;
        break;
      case '-i':
      case '--image':
        options.image = resolve(process.cwd(), args[++i]);
        break;
      case '--base':
        options.base = true;
        break;
      case '--denoise':
        options.denoise = parseFloat(args[++i]);
        break;
      case '-u':
      case '--url':
        options.url = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '--workflow':
        options.workflowPath = resolve(process.cwd(), args[++i]);
        break;
      case '--no-meta':
        options.saveMeta = false;
        break;
      default:
        if (!options.prompt && !arg.startsWith('-')) {
          options.prompt = arg;
        }
        break;
    }
  }

  return options;
}

/**
 * Normalizes and removes trailing slash from URL
 */
function cleanUrl(url) {
  return url.replace(/\/+$/, '');
}

/**
 * Uploads an image to ComfyUI /upload/image endpoint
 */
export async function uploadImage(baseUrl, imagePath) {
  if (!existsSync(imagePath)) {
    throw new Error(`Base image file not found: ${imagePath}`);
  }
  const fileBuffer = readFileSync(imagePath);
  const fileName = basename(imagePath);
  const formData = new FormData();
  formData.append('image', new Blob([fileBuffer]), fileName);
  formData.append('overwrite', 'true');

  const res = await fetch(`${baseUrl}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to upload base image (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.name || fileName;
}

/**
 * Prepares the workflow graph with requested parameters
 */
export function prepareWorkflow(rawWorkflow, params) {
  const workflow = JSON.parse(JSON.stringify(rawWorkflow));

  let ksampler = null;
  let latent = null;
  let saveImage = null;
  let promptNode = null;
  let negativeNode = null;
  let loadImage = null;

  // Identify nodes
  for (const [id, node] of Object.entries(workflow)) {
    if (node.class_type === 'KSampler') ksampler = node;
    if (node.class_type === 'EmptyLatentImage') latent = node;
    if (node.class_type === 'SaveImage') saveImage = node;
    if (node.class_type === 'LoadImage') loadImage = node;
  }

  if (ksampler) {
    const posId = ksampler.inputs?.positive?.[0];
    if (posId && workflow[posId]) promptNode = workflow[posId];

    const negId = ksampler.inputs?.negative?.[0];
    if (negId && workflow[negId]) negativeNode = workflow[negId];
  }

  // Fallbacks if not linked through KSampler
  if (!promptNode && workflow['6']) promptNode = workflow['6'];
  if (!negativeNode && workflow['7']) negativeNode = workflow['7'];

  // Apply base image to LoadImage if present
  if (params.baseImageName && loadImage?.inputs) {
    loadImage.inputs.image = params.baseImageName;
  }

  // Apply Prompt
  if (params.prompt !== undefined && promptNode?.inputs) {
    promptNode.inputs.text = params.prompt;
  }

  // Apply Negative Prompt
  if (params.negative !== undefined && negativeNode?.inputs) {
    negativeNode.inputs.text = params.negative;
  }

  // Apply Seed & Denoise
  const finalSeed =
    params.seed !== undefined && !Number.isNaN(params.seed)
      ? params.seed
      : Math.floor(Math.random() * 9007199254740991); // Max safe JS integer

  if (ksampler?.inputs) {
    ksampler.inputs.seed = finalSeed;
    if (params.steps !== undefined) ksampler.inputs.steps = params.steps;
    if (params.cfg !== undefined) ksampler.inputs.cfg = params.cfg;
    if (params.denoise !== undefined) ksampler.inputs.denoise = params.denoise;
  }

  // Apply Dimensions (only for EmptyLatentImage)
  if (latent?.inputs) {
    if (params.width !== undefined) latent.inputs.width = params.width;
    if (params.height !== undefined) latent.inputs.height = params.height;
  }

  // Set prefix
  if (saveImage?.inputs) {
    saveImage.inputs.filename_prefix = 'Flux_KZ';
  }

  return {
    workflow,
    metadata: {
      prompt: promptNode?.inputs?.text || '',
      negative: negativeNode?.inputs?.text || '',
      seed: finalSeed,
      steps: ksampler?.inputs?.steps,
      cfg: ksampler?.inputs?.cfg,
      denoise: ksampler?.inputs?.denoise,
      baseImage: params.baseImageName || null,
      width: latent?.inputs?.width,
      height: latent?.inputs?.height,
    },
  };
}

/**
 * Main generate function
 */
export async function generateImage(options = {}) {
  const baseUrl = cleanUrl(options.url || DEFAULT_URL);
  let workflowFile = options.workflowPath || DEFAULT_WORKFLOW;

  let baseImageName = null;
  if (options.image) {
    process.stdout.write(`📤 Uploading base image (${basename(options.image)})... `);
    baseImageName = await uploadImage(baseUrl, options.image);
    console.log(`Done! (Server file: ${baseImageName})`);

    // If using default text2img workflow, switch to img2img workflow
    if (workflowFile === DEFAULT_WORKFLOW) {
      workflowFile = resolve(__dirname, 'flux-img2img-workflow.json');
    }
  }

  if (!existsSync(workflowFile)) {
    throw new Error(`Workflow file not found: ${workflowFile}`);
  }

  const rawWorkflow = JSON.parse(readFileSync(workflowFile, 'utf8'));
  const { workflow, metadata } = prepareWorkflow(rawWorkflow, { ...options, baseImageName });

  console.log(`\n🚀 Connecting to ComfyUI at: ${baseUrl}`);
  console.log(`📝 Prompt: "${metadata.prompt}"`);
  if (metadata.negative) {
    console.log(`🚫 Negative: "${metadata.negative}"`);
  }
  console.log(
    `📐 Size: ${metadata.width}x${metadata.height} | Steps: ${metadata.steps} | CFG: ${metadata.cfg} | Seed: ${metadata.seed}\n`,
  );

  const clientId = crypto.randomUUID();

  // 1. Submit prompt
  process.stdout.write('⏳ Submitting generation task to ComfyUI queue... ');
  const submitRes = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: workflow,
      client_id: clientId,
    }),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text();
    throw new Error(`Failed to queue prompt (HTTP ${submitRes.status}): ${errorText}`);
  }

  const submitData = await submitRes.json();
  const promptId = submitData.prompt_id;
  if (!promptId) {
    throw new Error(`No prompt_id returned: ${JSON.stringify(submitData)}`);
  }
  console.log(`Done! (Prompt ID: ${promptId})`);

  // 2. Poll for completion
  const startTime = Date.now();
  let imageOutputs = [];
  let dots = 0;

  while (true) {
    await new Promise((r) => setTimeout(r, 1200));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // Check history
    let historyRes;
    try {
      historyRes = await fetch(`${baseUrl}/history/${promptId}`);
    } catch {
      // In case of transient network hiccup, retry next tick
      continue;
    }

    if (!historyRes.ok) continue;

    const historyData = await historyRes.json();
    const result = historyData[promptId];

    if (result) {
      if (result.status?.status_str === 'error') {
        console.log('\n');
        throw new Error(`ComfyUI generation failed: ${JSON.stringify(result.status)}`);
      }

      if (result.outputs) {
        for (const nodeOutput of Object.values(result.outputs)) {
          if (Array.isArray(nodeOutput.images)) {
            imageOutputs.push(...nodeOutput.images);
          }
        }
      }

      if (imageOutputs.length > 0) {
        process.stdout.write(`\r✨ Generation completed in ${elapsed}s!                     \n`);
        break;
      }
    }

    // Still running or in queue - update progress in terminal
    dots = (dots + 1) % 4;
    const dotStr = '.'.repeat(dots).padEnd(3, ' ');
    process.stdout.write(`\r⚙️  Rendering image on GPU${dotStr} (${elapsed}s elapsed)`);
  }

  // 3. Download images
  const downloadedFiles = [];
  const outputTarget = options.output || DEFAULT_OUTPUT_DIR;

  const isExplicitFile =
    extname(outputTarget).toLowerCase() === '.png' ||
    extname(outputTarget).toLowerCase() === '.jpg' ||
    extname(outputTarget).toLowerCase() === '.webp';

  const outputDir = isExplicitFile ? dirname(outputTarget) : outputTarget;
  mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < imageOutputs.length; i++) {
    const imgInfo = imageOutputs[i];
    const viewUrl = new URL(`${baseUrl}/view`);
    viewUrl.searchParams.set('filename', imgInfo.filename);
    viewUrl.searchParams.set('subfolder', imgInfo.subfolder || '');
    viewUrl.searchParams.set('type', imgInfo.type || 'output');

    console.log(`📥 Downloading: ${imgInfo.filename}`);
    const imgRes = await fetch(viewUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to download image (HTTP ${imgRes.status}): ${viewUrl}`);
    }

    const imageBuffer = Buffer.from(await imgRes.arrayBuffer());

    let finalFilePath;
    if (isExplicitFile && imageOutputs.length === 1) {
      finalFilePath = outputTarget;
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}_seed${metadata.seed}_${imgInfo.filename}`;
      finalFilePath = join(outputDir, filename);
    }

    writeFileSync(finalFilePath, imageBuffer);
    downloadedFiles.push(finalFilePath);

    // Save metadata
    if (options.saveMeta !== false) {
      const metaPath = finalFilePath.replace(/\.[^.]+$/, '.json');
      const metaContent = {
        generatedAt: new Date().toISOString(),
        promptId,
        endpoint: baseUrl,
        comfyImage: imgInfo,
        ...metadata,
      };
      writeFileSync(metaPath, JSON.stringify(metaContent, null, 2));
    }
  }

  console.log(`\n🎉 Success! Saved ${downloadedFiles.length} image(s):`);
  for (const file of downloadedFiles) {
    console.log(`📁 ${file}`);
  }

  return {
    images: downloadedFiles,
    metadata,
    promptId,
  };
}

/**
 * Loads Dog Relay cards from @repo/types
 */
export async function loadDogRelayCards() {
  try {
    const cardsModule = await import('../../packages/types/dist/dog-relay-cards.js');
    return cardsModule.DOG_RELAY_CARDS || [];
  } catch {
    return [];
  }
}

/**
 * Finds a card by id, number, or name (TH/EN)
 */
export function findDogRelayCard(cards, query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  const numMatch = q.replace(/^#/, '').replace(/^dog-/, '');
  const numPad = numMatch.padStart(3, '0');

  return cards.find((c) => {
    const cardNum = c.number.replace(/^#/, '');
    if (c.id.toLowerCase() === q || c.id === `dog-${numPad}`) return true;
    if (cardNum === numPad || cardNum === numMatch) return true;
    if (c.name.en.toLowerCase().includes(q) || q.includes(c.name.en.toLowerCase())) return true;
    if (c.name.th.includes(query)) return true;
    return false;
  });
}

/**
 * Synthesizes a cute 2D sticker style prompt for a Dog Relay card
 */
export function buildDogRelayPrompt(card, useBaseImage = false) {
  let changes = card.description?.en || '';
  if (card.generationPrompt) {
    const match = card.generationPrompt.match(/REQUESTED CHANGES:\s*(.*?)(?:\nCOMPOSITION:|$)/s);
    if (match) {
      changes = match[1]
        .replace(/\n/g, ' ')
        .replace(/^Add only\s+/i, '')
        .replace(/over the unchanged seated body[,.]?/gi, '')
        .replace(/fitted over the unchanged seated body[,.]?/gi, '')
        .replace(/on the ground beside the dog/gi, 'on the floor beside the dog')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  if (useBaseImage) {
    return `A cute 2D cartoon golden retriever puppy wearing ${changes}. Flat cel-shaded cartoon illustration, vibrant colors, clean dark outlines, plain white background, sticker art style`;
  }

  return `A cute 2D cartoon character illustration of a golden retriever puppy seated front-facing, happy smiling open mouth with tongue out, pink blushing cheeks, wearing a blue collar with a small round gold bell. As a ${card.name.en} character: ${changes} Thick dark brown outlines, flat cel-shaded colors, vibrant colors, isolated on pure plain white background, vector sticker art, game asset icon, masterpiece, high quality, no text`;
}

// CLI entry point
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const DEFAULT_DOG_BASE = resolve(
    process.cwd(),
    'apps/web/public/images/who-barks/base/dog-base.png',
  );

  if (options.base && !options.image) {
    options.image = DEFAULT_DOG_BASE;
  }

  const dogCards = await loadDogRelayCards();

  if (options.listCards) {
    console.log(`\n🐶 Dog Relay Character Cards (Total: ${dogCards.length}):`);
    console.log('---------------------------------------------------------');
    for (const c of dogCards) {
      console.log(`${c.number.padEnd(6)} | ${c.name.th.padEnd(20)} | ${c.name.en}`);
    }
    console.log('---------------------------------------------------------');
    console.log('Usage example: pnpm gen:image --card dog-001 --base\n');
    process.exit(0);
  }

  if (options.card) {
    const card = findDogRelayCard(dogCards, options.card);
    if (!card) {
      console.error(`\n❌ Dog Relay Card not found: "${options.card}"`);
      console.log('Tip: Run "pnpm gen:image --list-cards" to see all available cards.');
      process.exit(1);
    }

    console.log(`\n🎯 Selected Dog Relay Card: ${card.number} ${card.name.th} (${card.name.en})`);
    if (!options.prompt) {
      options.prompt = buildDogRelayPrompt(card, Boolean(options.image));
    }
    if (options.output === DEFAULT_OUTPUT_DIR) {
      options.output = join(DEFAULT_OUTPUT_DIR, `dog-relay-${card.id}.png`);
    }
  }

  try {
    await generateImage(options);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}
