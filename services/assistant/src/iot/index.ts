import { isSwitchDevice } from "./device";
import { DeviceManager } from "./device-manager";

export { isSwitchDevice, isDimmableDevice } from "./device";

export const deviceManager = new DeviceManager();
deviceManager.discover();

async function switchAction(
  deviceName: string,
  command: "turnOn" | "turnOff" | "toggle",
) {
  const device = deviceManager.getDeviceByName(deviceName);
  if (!device || !isSwitchDevice(device)) {
    return;
  }
  await device[command]();
}

export function getDevicesListForLLM() {
  const devices = deviceManager.devices;
  if (devices.length === 0) {
    return "No devices are available right now.";
  }
  let instructions = "Available devices:";
  for (const device of devices) {
    instructions += `\n- ${JSON.stringify(device.detailsForLLM)}`;
  }
  return instructions;
}

deviceManager.on("device", (device) => {
  console.log(
    `${JSON.stringify({ id: device.id, name: device.name, type: device.type })},`,
  );
});

deviceManager.on("zigbee:command", (command, device) => {
  console.log("zigbee:command:", command, device);
  const deviceName = "living room light";
  if (command === "on") {
    switchAction(deviceName, "turnOn");
  } else if (command === "off") {
    switchAction(deviceName, "turnOff");
  } else if (command === "toggle") {
    switchAction(deviceName, "toggle");
  }
});
