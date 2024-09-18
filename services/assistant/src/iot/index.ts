import { isSwitchDevice } from "./device";
import { DeviceManager } from "./device-manager";

export { isSwitchDevice, isDimmableDevice } from "./device";

export const deviceManager = new DeviceManager();
deviceManager.discover();

deviceManager.on("zigbee:command", (command, device) => {
  console.log("zigbee:command:", command, device);
  const allLights = deviceManager.devices;
  console.log("lights:", allLights);
  for (const lights of allLights) {
    if (!isSwitchDevice(lights)) {
      continue;
    }
    if (command === "on") {
      lights.turnOn();
    } else if (command === "off") {
      lights.turnOff();
    } else if (command === "toggle") {
      lights.toggle();
    }
  }
});
