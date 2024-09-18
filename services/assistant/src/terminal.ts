// terminal interface to interact with the assistant
import "dotenv/config";
import readline from "node:readline/promises";
import { startThread } from "./ai/thread";
import { say } from "./ai/voice";
import { deviceManager } from "./iot";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "user> ",
});

async function main() {
  {
    await using thread = await startThread();

    rl.prompt();
    for await (const line of rl) {
      const response = await thread.sendMessage(line.trim());
      console.log(`${response.role}> ${response.content}`);
      say(response.content);
      rl.prompt();
    }
  }

  rl.close();
  await deviceManager.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
