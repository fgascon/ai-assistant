import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import Queue from "p-queue";
import playSound from "play-sound";
import { logger } from "../observability/logger";
import { openai } from "./openai";
import { isNodeError } from "../utils/error";

const queue = new Queue({ concurrency: 1 });

queue.on("error", (error) => {
  logger.error("Voice queue error", { error });
});

const cacheDir = new URL("../../../../voice-cache/", import.meta.url);

async function fileExists(filePath: URL): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function generateSpeechFile(text: string): Promise<URL> {
  const textHash = crypto.createHash("sha256").update(text).digest("hex");
  const filePath = new URL(`${textHash}.mp3`, cacheDir);

  if (await fileExists(filePath)) {
    logger.debug("Speech file already exists", { text, filePath });
    return filePath;
  }
  await fs.promises.mkdir(cacheDir, { recursive: true });

  logger.debug("Generating speech", { text });
  const response = await openai.audio.speech.create({
    input: text,
    model: "tts-1",
    voice: "alloy",
    response_format: "mp3",
  });
  if (!response.ok || !response.body) {
    logger.error("OpenAI speech error", {
      response: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      },
    });
    throw new Error("Failed to generate speech");
  }
  logger.debug("Speech generated", { text });

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(filePath, buffer);
  logger.debug("Streaming speech to file", { filePath });

  return filePath;
}

async function playFile(filePath: URL): Promise<void> {
  const player = playSound();
  return new Promise<void>((resolve, reject) => {
    player.play(fileURLToPath(filePath), (error: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function say(text: string) {
  queue.add(async () => {
    try {
      const filePath = await generateSpeechFile(text);
      await playFile(filePath);
    } catch (error) {
      logger.error("Voice error", { error });
    }
  });
}
