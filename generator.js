import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";


import dotenv from "dotenv";
dotenv.config();

fal.config({
  credentials: process.env.FAL_AI_API_KEY,
});

// --- Mad Libs Prompt Generator ---

// Arrays of options for different prompt components.
const hairStyles = [
  // Original
  "silver",
  "pink",
  "black",
  "blonde",
  "chestnut",
  // Added
  "auburn",
  "platinum",
  "crimson",
  "navy",
  "teal",
  "violet",
  "copper",
  "golden",
  "emerald",
  "lavender",
  "burgundy",
  "ginger",
  "ash",
  "caramel",
  "chocolate",
  "honey",
  "rust",
  "sapphire",
  "pearl",
  "mahogany"
];

const eyeColors = [
  // Original
  "blue",
  "emerald",
  "amber",
  "violet",
  "hazel",
  // Added
  "gold",
  "silver",
  "copper",
  "jade",
  "crimson",
  "aqua",
  "midnight",
  "honey",
  "slate",
  "ruby",
  "topaz",
  "pearl",
  "obsidian",
  "coral",
  "turquoise",
  "indigo",
  "bronze",
  "steel",
  "sage",
  "rust"
];

const clothingStyles = [
  // Original
  "streetwear",
  "kimono",
  "uniform",
  "vintage",
  // Added
  "gothic",
  "punk",
  "preppy",
  "bohemian",
  "sporty",
  "formal",
  "casual",
  "business",
  "grunge",
  "military",
  "retro",
  "minimalist",
  "cyberpunk",
  "traditional",
  "athleisure",
  "regal",
  "western",
  "rockstar",
  "tribal",
  "steampunk"
];

const poses = [
  // Original
  "contemplative",
  "candid",
  "action",
  "profile",
  "motion",
  // Added
  "sitting",
  "standing",
  "running",
  "jumping",
  "walking",
  "dancing",
  "floating",
  "resting",
  "fighting",
  "crouching",
  "reaching",
  "leaning",
  "spinning",
  "stretching",
  "flying",
  "falling",
  "reading",
  "sleeping",
  "drawing",
  "singing"
];

const backgrounds = [
  // Original
  "skyline",
  "garden",
  "ruins",
  "gradient",
  "sunset",
  // Added
  "forest",
  "beach",
  "mountains",
  "desert",
  "cafe",
  "library",
  "temple",
  "station",
  "park",
  "studio",
  "carnival",
  "rooftop",
  "arcade",
  "classroom",
  "space",
  "meadow",
  "castle",
  "market",
  "workshop",
  "alley"
];

// Utility function to randomly pick an element from an array.
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generates a random waifu prompt based on the mad libs template.
function generateWaifuPrompt() {
  return `hand-drawn illustrated manga in a hand-inked style, with flat shading
  the character is a cute waifu with ${getRandomElement(
    hairStyles
  )} hair and ${getRandomElement(eyeColors)} eyes, wearing a ${getRandomElement(
    clothingStyles
  )} outfit in a ${getRandomElement(poses)} pose. The background is ${getRandomElement(
    backgrounds
  )}. Anime / manga style, i.e. very hand-drawn.`;
}

// --- Fal.ai Image Generator & Batching ---

// Define the folder where images will be saved.
const folderPath = path.resolve("generated_images");
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true });
}

/**
 * Generates a single image using Fal.ai with a randomized prompt and saves it to disk.
 * @param {number} imageIndex - The sequential index for the image.
 */
async function generateImage(imageIndex) {
  try {
    // Generate a new prompt using our mad libs generator.
    const prompt = generateWaifuPrompt();
    console.log(`Generating image ${imageIndex} with prompt:\n${prompt}\n`);

    // Call the Fal.ai API with the generated prompt.
    const result = await fal.subscribe("fal-ai/flux-pro/v1.1-ultra", {
      input: { prompt,
        aspect_ratio: "1:1",
       },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    // Check if result.data is an object and extract the URL.
    let imageUrl;
    if (typeof result.data === "object" && result.data !== null) {
      // If there's a direct 'url' property
      if (result.data.url) {
        imageUrl = result.data.url;
      }
      // Otherwise, check for an 'images' array
      else if (
        result.data.images &&
        Array.isArray(result.data.images) &&
        result.data.images.length > 0 &&
        result.data.images[0].url
      ) {
        imageUrl = result.data.images[0].url;
      } else {
        throw new Error(
          "result.data does not contain a valid URL property: " +
            JSON.stringify(result.data)
        );
      }
    } else {
      imageUrl = result.data;
    }

    console.log(`Image ${imageIndex}: URL received: ${imageUrl}`);

    // Download the image data using fetch.
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download image ${imageIndex}: ${response.statusText}`
      );
    }
    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Save the image to a file (adjust the extension if needed).
    const filePath = path.join(folderPath, `image_${imageIndex}.jpg`);
    fs.writeFileSync(filePath, imageBuffer);
    console.log(`Saved image ${imageIndex} to ${filePath}`);
  } catch (error) {
    console.error(`Error generating image ${imageIndex}:`, error);
  }
}

/**
 * Generates a total number of images in batches.
 * @param {number} totalImages - The total number of images to generate.
 * @param {number} batchSize - The number of images to generate concurrently.
 */
async function generateImages(totalImages = 1000, batchSize = 10) {
  for (let i = 0; i < totalImages; i += batchSize) {
    const batchPromises = [];
    for (let j = i; j < Math.min(i + batchSize, totalImages); j++) {
      batchPromises.push(generateImage(j));
    }
    // Wait for the current batch to finish.
    await Promise.all(batchPromises);
    console.log(
      `Batch ${Math.floor(i / batchSize) + 1} complete (images ${i} to ${Math.min(
        i + batchSize,
        totalImages
      ) - 1}).`
    );
  }
}

// --- Start the Generation Process ---
generateImages().catch((error) => {
  console.error("Error during image generation:", error);
});