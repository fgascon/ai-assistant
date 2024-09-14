import { DeviceManager } from "./device-manager";

async function main() {
  await using deviceManager = new DeviceManager();
  deviceManager.on("device", (device) => {
    if (device.name === "Living room lights") {
      device.turnOff().then(() => console.log("turned on"));
    }
  });
  await deviceManager.discover();
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
