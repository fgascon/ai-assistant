import { DeviceManager } from "./kasa/device-manager";

export const deviceManager = new DeviceManager();
deviceManager.discover();
