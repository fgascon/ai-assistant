import { EventEmitter } from "node:events";
import { KasaDiscovery } from "./kasa/discovery";
import type { Device } from "./device";
import { ZigbeeController, type ZigbeeDevice } from "./zigbee";
import { logger } from "../observability/logger";
import { USBWatcher } from "./usb";
import { zigbeeConfig } from "../config";

type DeviceManagerEvents = {
  device: [Device];
  "zigbee:command": [string, ZigbeeDevice];
  error: [Error];
};

const kasaDeviceWhitelist = [
  "80068DE07DD92B029E714DB37829E3A81F221F98",
  "80063E24FAAB946812EB5DFFC453D7581EC37D3F",
];

export class DeviceManager extends EventEmitter<DeviceManagerEvents> {
  private _kasaDiscovery = new KasaDiscovery();
  private _zigbee: ZigbeeController | undefined;
  private _devices: Device[] = [];

  constructor() {
    super();
    this._kasaDiscovery.on("error", (error) => {
      this.emit("error", error);
    });
    this._kasaDiscovery.on("device", (device) => {
      if (kasaDeviceWhitelist.includes(device.deviceId)) {
        this._devices.push(device);
        this.emit("device", device);
      }
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
    this._zigbee?.enableJoin();
  }

  disablePairing() {
    this._zigbee?.disableJoin();
  }

  get devices() {
    return this._devices.concat();
  }

  getDeviceByName(name: string) {
    return this._devices.find((device) => device.name === name);
  }

  async close() {
    await Promise.all([
      this._kasaDiscovery.close(),
      this.removeZigbeeController(),
    ]);
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
