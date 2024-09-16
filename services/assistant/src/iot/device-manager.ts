import { EventEmitter } from "node:events";
import { KasaDiscovery } from "./kasa/discovery";
import type { Device } from "./device";

type DeviceManagerEvents = {
  device: [Device];
  error: [Error];
};

const kasaDeviceWhitelist = [
  "80068DE07DD92B029E714DB37829E3A81F221F98",
  "80063E24FAAB946812EB5DFFC453D7581EC37D3F",
];

export class DeviceManager extends EventEmitter<DeviceManagerEvents> {
  private _kasaDiscovery = new KasaDiscovery();
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

  get devices() {
    return this._devices.concat();
  }

  getDeviceByName(name: string) {
    return this._devices.find((device) => device.name === name);
  }

  async [Symbol.asyncDispose]() {
    await this._kasaDiscovery.close();
  }
}
