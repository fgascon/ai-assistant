// terminal interface to interact with the assistant
import "dotenv/config";
import readline from "node:readline/promises";
import { startThread } from "./ai/thread";
import { homeassistant } from "./homeassistant";
import { say } from "./ai/voice";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "user> ",
});

async function main() {
  await using thread = await startThread();

  homeassistant.on("toggleDevice", async ({ action, deviceId }) => {
    console.log(`ha> device ${deviceId} ${action}`);
  });

  rl.prompt();
  for await (const line of rl) {
    const response = await thread.sendMessage(line.trim());
    console.log(`${response.role}> ${response.content}`);
    say(response.content);
    rl.prompt();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
