import { z } from "zod";
import { getErrorMessage } from "../utils/error";
import { homeassistant } from "../homeassistant";

type ToolImplementation = {
  argumentsSchema: z.ZodSchema<unknown>;
  fnc: (params: unknown) => Promise<unknown>;
};

const toolsImplementation: Record<string, ToolImplementation> = {};

function addTool<Params>(options: {
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
  try {
    const implementation = toolsImplementation[name];
    if (!implementation) {
      throw new Error(`Tool ${name} not found`);
    }

    const params = parseToolArguments(args, implementation.argumentsSchema);
    const result = implementation.fnc(params);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      error: getErrorMessage(error),
    });
  }
}

addTool({
  name: "toggle_switch",
  schema: z.object({
    device_id: z.enum([
      "living_room",
      "master_bedroom",
      "kid_bedroom",
      "driveway",
    ]),
    action: z.enum(["on", "off", "toggle"]),
  }),
  fnc: async ({ action, device_id: deviceId }) => {
    await homeassistant.toggleDevice({ action, deviceId });
    return {
      success: true,
    };
  },
});
