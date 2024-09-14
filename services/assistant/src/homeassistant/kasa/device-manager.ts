import { EventEmitter } from "node:events";
import { Discovery } from "./discovery";
import type { Device } from "./devices";

type DeviceManagerEvents = {
  device: [Device];
  error: [Error];
};

const deviceWhitelist = [
  "80068DE07DD92B029E714DB37829E3A81F221F98",
  "80063E24FAAB946812EB5DFFC453D7581EC37D3F",
];

export class DeviceManager extends EventEmitter<DeviceManagerEvents> {
  private _discovery = new Discovery();
  private _devices: Device[] = [];

  constructor() {
    super();
    this._discovery.on("error", (error) => {
      this.emit("error", error);
    });
    this._discovery.on("device", (device) => {
      if (deviceWhitelist.includes(device.deviceId)) {
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
      await this._discovery.discover();
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
    await this._discovery.close();
  }
}
