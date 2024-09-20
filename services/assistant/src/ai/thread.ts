import EventEmitter from "node:events";
import OpenAI from "openai";
import { logger } from "../observability/logger";
import { requireEnvVar } from "../config";
import { callTool } from "./tools";
import { openai } from "./openai";
import { getDevicesListForLLM } from "../iot";

const assistantId = requireEnvVar("OPENAI_ASSISTANT_ID");

type Message = {
  role: string;
  content: string;
};

type ThreadEvents = {
  message: [Message];
  "run.completed": [];
  error: [unknown];
};

class Thread extends EventEmitter<ThreadEvents> {
  constructor(
    public readonly id: string,
    public readonly assistantId: string,
  ) {
    super();
  }

  async addMessage(message: { role: "user" | "assistant"; content: string }) {
    const response = await openai.beta.threads.messages.create(
      this.id,
      message,
    );
    logger.debug("OpenAI message created", { message: response });
  }

  private async handleSubmitToolCalls(
    runId: string,
    toolCalls: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[],
  ) {
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall) => {
        logger.debug("Call tool", { toolCall });
        const output = await callTool(
          toolCall.function.name,
          toolCall.function.arguments,
        );
        return {
          tool_call_id: toolCall.id,
          output,
        };
      }),
    );
    const toolOutputsStream = openai.beta.threads.runs.submitToolOutputsStream(
      this.id,
      runId,
      {
        tool_outputs: toolCallOutputs,
      },
    );
    toolOutputsStream.on("error", (error) => {
      this.emit("error", error);
    });
    toolOutputsStream.on("event", (event) => {
      this.handleEvent(event);
    });
  }

  private handleEvent(event: OpenAI.Beta.Assistants.AssistantStreamEvent) {
    logger.debug(`OpenAI event: ${event.event}`, { data: event.data });
    if (event.event === "thread.message.completed") {
      let content = "";
      for (const messageContent of event.data.content) {
        if (messageContent.type === "text") {
          content += messageContent.text.value;
        }
      }
      this.emit("message", {
        role: event.data.role,
        content,
      });
    } else if (
      event.event === "thread.run.failed" ||
      event.event === "thread.run.incomplete"
    ) {
      logger.error("Thread run failed", { run: event.data });
      this.emit("error", new Error("Thread run failed"));
    } else if (event.event === "thread.run.completed") {
      this.emit("run.completed");
    } else if (
      event.event === "thread.run.requires_action" &&
      event.data.required_action?.type === "submit_tool_outputs"
    ) {
      this.handleSubmitToolCalls(
        event.data.id,
        event.data.required_action.submit_tool_outputs.tool_calls,
      ).catch((error) => {
        this.emit("error", error);
      });
    }
  }

  run() {
    const runStream = openai.beta.threads.runs.stream(this.id, {
      assistant_id: this.assistantId,
      additional_instructions: getDevicesListForLLM(),
    });
    runStream.on("error", (error) => {
      this.emit("error", error);
    });
    runStream.on("event", (event) => {
      this.handleEvent(event);
    });
  }

  async waitForMessage() {
    return new Promise<Message>((resolve, reject) => {
      this.once("error", reject);
      this.once("message", (message) => {
        this.removeListener("error", reject);
        resolve(message);
      });
    });
  }

  async delete() {
    await openai.beta.threads.del(this.id);
    logger.debug("OpenAI thread deleted", { threadId: this.id });
  }
}

export async function startThread() {
  const threadResponse = await openai.beta.threads.create({});
  logger.debug("OpenAI thread created", { thread: threadResponse });
  const thread = new Thread(threadResponse.id, assistantId);

  return {
    async sendMessage(messageContent: string) {
      await thread.addMessage({
        role: "user",
        content: messageContent,
      });
      thread.run();

      const message = await thread.waitForMessage();
      logger.info(`${message.role} message: ${message.content}`);
      return message;
    },
    async [Symbol.asyncDispose]() {
      await thread.delete();
    },
  };
}
