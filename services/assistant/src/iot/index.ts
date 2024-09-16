import { DeviceManager } from "./device-manager";

export { isSwitchDevice, isDimmableDevice } from "./device";

export const deviceManager = new DeviceManager();
deviceManager.discover();
