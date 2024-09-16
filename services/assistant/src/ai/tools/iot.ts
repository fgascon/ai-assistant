import { z } from "zod";
import { deviceManager, isDimmableDevice, isSwitchDevice } from "../../iot";
import { logger } from "../../observability/logger";
import { addTool } from "./tools-util";

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
    if (!isSwitchDevice(device)) {
      throw new Error(
        `Device "${name}" is not a switch. Only switch type devices can be turned on or off.`,
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
          note: `Device "${name}" does not support brightness as it is not a dimmable switch, but device was turned ${state}`,
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
