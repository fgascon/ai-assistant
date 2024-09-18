import { EventEmitter } from "node:events";
import { KasaDiscovery } from "./kasa/discovery";
import type { Device } from "./device";
import { ZigbeeController, type ZigbeeDevice } from "./zigbee";
import { logger } from "../observability/logger";

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
  private _zigbee = new ZigbeeController();
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
    this._zigbee.on("message", ({ type, device }) => {
      logger.debug("zigbee message:", { type, device });
      if (type.startsWith("command")) {
        const commandName = type.substring("command".length).toLowerCase();
        this.emit("zigbee:command", commandName, device);
      }
    });
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
    this._zigbee.enableJoin();
  }

  disablePairing() {
    this._zigbee.disableJoin();
  }

  get devices() {
    return this._devices.concat();
  }

  getDeviceByName(name: string) {
    return this._devices.find((device) => device.name === name);
  }

  async close() {
    await Promise.all([this._kasaDiscovery.close(), this._zigbee.close()]);
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
