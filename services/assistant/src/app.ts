import { Hono } from "hono";
import { startThread } from "./ai/thread";
import { say } from "./ai/voice";

export const app = new Hono();

app.get("/", async (c) => {
  await using thread = await startThread();
  const response = await thread.sendMessage("turn on the living room lights");
  say(response.content);
  return c.json({ response });
});
