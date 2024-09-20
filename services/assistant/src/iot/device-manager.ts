import { EventEmitter } from "node:events";
import { KasaDiscovery } from "./kasa/discovery";
import type { Device } from "./device";
import { ZigbeeController, type ZigbeeDevice } from "./zigbee";
import { logger } from "../observability/logger";
import { USBWatcher } from "./usb";
import { zigbeeConfig } from "../config";
import { DeviceRegister } from "./device-register";
import { resolveRootPath } from "../utils/path";

type DeviceManagerEvents = {
  device: [Device];
  "zigbee:command": [string, ZigbeeDevice];
  error: [Error];
};

export class DeviceManager extends EventEmitter<DeviceManagerEvents> {
  private _devices: Device[] = [];
  private _deviceRegister = new DeviceRegister({
    path: resolveRootPath("data/devices.yaml"),
  });
  private _pairingEnabled = false;
  private _kasaDiscovery = new KasaDiscovery();
  private _zigbee: ZigbeeController | undefined;

  constructor() {
    super();
    this._kasaDiscovery.on("error", (error) => {
      this.emit("error", error);
    });
    this._kasaDiscovery.on("device", (device) => {
      this.addDevice(device);
    });

    if (zigbeeConfig) {
      const zigbeeUsbWatcher = new USBWatcher(zigbeeConfig);
      zigbeeUsbWatcher.on("error", (error) => {
        this.emit("error", error);
      });
      zigbeeUsbWatcher.on("connect", (usbDevice) =>
        this.addZigbeeController(usbDevice.path),
      );
      zigbeeUsbWatcher.on("disconnect", () => {
        this.removeZigbeeController().catch((error) => {
          this.emit("error", error);
        });
      });
    }
  }

  private addDevice(device: Device) {
    this._devices.push(device);
    this._deviceRegister.registerDevice(device);
    this.emit("device", device);
  }

  private async addZigbeeController(usbSerialPath: string) {
    if (this._zigbee) {
      this._zigbee.removeAllListeners();
      this._zigbee.close().catch((error) => {
        this.emit("error", error);
      });
    }
    logger.info("Adding Zigbee controller", { usbSerialPath });
    this._zigbee = new ZigbeeController(usbSerialPath);
    this._zigbee.on("message", ({ type, device }) => {
      logger.debug("zigbee message:", { type, device });
      if (type.startsWith("command")) {
        const commandName = type.substring("command".length).toLowerCase();
        this.emit("zigbee:command", commandName, device);
      }
    });
    this._zigbee.on("device", (device) => {
      this.addDevice(device);
    });
    if (this._pairingEnabled) {
      this._zigbee.enableJoin();
    }
  }

  private async removeZigbeeController() {
    if (this._zigbee) {
      this._zigbee.removeAllListeners();
      await this._zigbee.close();
      this._zigbee = undefined;
    }
  }

  async discover() {
    const discoveryTimeout = 5;
    const discoveryPackets = 3;
    const sleepBetweenPackets = discoveryTimeout / discoveryPackets;
    for (let i = 0; i < discoveryPackets; i++) {
      await this._kasaDiscovery.discover();
      await new Promise((resolve) =>
        setTimeout(resolve, sleepBetweenPackets * 1000),
      );
    }
  }

  enablePairing() {
    this._pairingEnabled = true;
    this._zigbee?.enableJoin();
  }

  disablePairing() {
    this._pairingEnabled = false;
    this._zigbee?.disableJoin();
  }

  get devices() {
    return this._devices.concat();
  }

  getDeviceByName(name: string) {
    return this._devices.find((device) => device.name === name);
  }

  getDeviceByLLMId(llmId: string | number) {
    const id = typeof llmId === "string" ? parseInt(llmId, 10) : llmId;
    return this._devices.find((device) => device.llmId === id);
  }

  async close() {
    await Promise.all([
      this._kasaDiscovery.close(),
      this.removeZigbeeController(),
      this._deviceRegister.close(),
    ]);
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
