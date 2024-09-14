import { z } from "zod";
import { getErrorMessage } from "../utils/error";
import { deviceManager } from "../homeassistant";
import { logger } from "../observability/logger";
import { IotDimmer } from "../homeassistant/kasa/devices";

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
  console.log("calling tool", name, args);
  try {
    const implementation = toolsImplementation[name];
    if (!implementation) {
      throw new Error(`Tool ${name} not found`);
    }

    const params = parseToolArguments(args, implementation.argumentsSchema);
    const result = await implementation.fnc(params);
    const stringifiedResult = JSON.stringify(result);
    console.log("tool result", stringifiedResult);
    return stringifiedResult;
  } catch (error) {
    const stringifiedResult = JSON.stringify({
      error: getErrorMessage(error),
    });
    console.log("tool result", stringifiedResult);
    return stringifiedResult;
  }
}

addTool({
  name: "set_state",
  schema: z.object({
    device_id: z.string(),
    state: z.enum(["on", "off"]),
    brightness: z.optional(z.number()),
  }),
  fnc: async ({ device_id: name, state, brightness }) => {
    logger.info(`set state of device "${name}"`, { name, state, brightness });
    const device = deviceManager.getDeviceByName(name);
    if (!device) {
      throw new Error(`Device "${name}" not found`);
    }
    switch (state) {
      case "on":
        await device.turnOn();
        break;
      case "off":
        await device.turnOff();
        break;
    }
    if (brightness !== undefined) {
      if (device instanceof IotDimmer) {
        await device.setBrightness(brightness);
      } else {
        return {
          success: true,
          note: `Device "${name}" does not support brightness, but device was turned ${state}`,
        };
      }
    }
    return {
      success: true,
    };
  },
});

addTool({
  name: "get_states",
  schema: z.unknown(),
  fnc: async () => {
    return deviceManager.devices.map((device) => ({
      name: device.name,
      state: device.state ? "on" : "off",
      brightness: "brightness" in device ? device.brightness : undefined,
    }));
  },
});
