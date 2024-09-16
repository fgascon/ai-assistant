import type { z } from "zod";
import { getErrorMessage } from "../../utils/error";
import { logger } from "../../observability/logger";

type ToolImplementation = {
  argumentsSchema: z.ZodSchema<unknown>;
  fnc: (params: unknown) => Promise<unknown>;
};

const toolsImplementation: Record<string, ToolImplementation> = {};

export function addTool<Params>(options: {
  name: string;
  schema: z.ZodSchema<Params>;
  fnc: (params: Params) => Promise<unknown>;
}) {
  toolsImplementation[options.name] = {
    argumentsSchema: options.schema,
    fnc: options.fnc as (params: unknown) => Promise<unknown>,
  };
}

function parseToolArguments(args: string, schema: z.ZodSchema) {
  try {
    return schema.parse(JSON.parse(args));
  } catch (error) {
    throw new Error(`Invalid tool arguments: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function callTool(name: string, args: string): Promise<string> {
  logger.debug("calling tool", { name, args });
  try {
    const implementation = toolsImplementation[name];
    if (!implementation) {
      throw new Error(`Tool ${name} not found`);
    }

    const params = parseToolArguments(args, implementation.argumentsSchema);
    const result = await implementation.fnc(params);
    const stringifiedResult = JSON.stringify(result);
    logger.debug("tool result", { stringifiedResult });
    return stringifiedResult;
  } catch (error) {
    const stringifiedResult = JSON.stringify({
      error: getErrorMessage(error),
    });
    logger.debug("tool result", { stringifiedResult });
    return stringifiedResult;
  }
}
