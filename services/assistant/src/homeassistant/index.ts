import { EventEmitter } from "events";
import { logger } from "../observability/logger";

type DeviceAction = "on" | "off" | "toggle";

type HomeAssistantAPIEvents = {
  toggleDevice: [{ action: DeviceAction; deviceId: string }];
};

class HomeAssistantAPI extends EventEmitter<HomeAssistantAPIEvents> {
  async toggleDevice(options: { deviceId: string; action: DeviceAction }) {
    logger.info(`${options.action} device ${options.deviceId}`);
    this.emit("toggleDevice", options);
  }
}

export const homeassistant = new HomeAssistantAPI();
