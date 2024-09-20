import { z } from "zod";
import { deviceManager, isDimmableDevice, isSwitchDevice } from "../../iot";
import { logger } from "../../observability/logger";
import { addTool } from "./tools-util";
import { DeviceType } from "../../iot/device";

addTool({
  name: "set_state",
  schema: z.object({
    device_id: z.number(),
    state: z.enum(["on", "off"]),
    brightness: z.optional(z.number()),
  }),
  fnc: async ({ device_id: deviceId, state, brightness }) => {
    logger.info(`set state of device "${deviceId}"`, {
      deviceId,
      state,
      brightness,
    });
    const device = deviceManager.getDeviceByLLMId(deviceId);
    if (!device) {
      throw new Error(
        `Invalid device_id: ${deviceId}. Valid values are: ${deviceManager.devices.map((device) => device.llmId).join(", ")}`,
      );
    }
    if (!device.isWhitelisted) {
      throw new Error(
        `You are not authorized to set_state on device "${deviceId}"`,
      );
    }
    if (!isSwitchDevice(device)) {
      throw new Error(
        `Device "${deviceId}" is not a switch. Only ${DeviceType.Switch} or ${DeviceType.DimmableSwitch} devices can be turned on or off.`,
      );
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
      if (isDimmableDevice(device)) {
        await device.setBrightness(brightness);
      } else {
        return {
          success: true,
          note: `Device "${deviceId}" does not support brightness as it is not a ${DeviceType.DimmableSwitch}, but device was turned ${state}`,
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
      type: device.type,
      name: device.name,
      state: isSwitchDevice(device) ? (device.state ? "on" : "off") : undefined,
      brightness: isDimmableDevice(device) ? device.brightness : undefined,
    }));
  },
});
