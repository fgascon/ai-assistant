import EventEmitter from "node:events";
import * as zh from "zigbee-herdsman";
import { dataPath } from "../../utils/path";
import { logger } from "../../observability/logger";
import InternalZigbeeDevice from "./model/device";
import { setLogger } from "./logger";
import type { ZigbeeDevice } from "./devices/base-zigbee-device";
import { ZigbeeButton } from "./devices/zigbee-button";

export type { ZigbeeDevice };

setLogger();

type HerdsmanExport = {
  default: {
    Controller: typeof zh.Controller;
  };
};

type ZigbeeControllerEvents = {
  device: [ZigbeeDevice];
  message: [{ type: string; device: ZigbeeDevice }];
  error: [unknown];
};

export class ZigbeeController extends EventEmitter<ZigbeeControllerEvents> {
  private herdsman: zh.Controller;
  private internlDeviceLookup: { [s: string]: InternalZigbeeDevice } = {};
  private deviceLookup: { [s: string]: ZigbeeDevice } = {};
  private readyPromise: Promise<void>;
  private setReady: () => void = () => {};

  constructor(usbSerialPath: string) {
    super();
    this.herdsman = new (zh as unknown as HerdsmanExport).default.Controller({
      network: {
        panID: 0x1a62,
        extendedPanID: [0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd],
        channelList: [11],
        networkKey: [1, 3, 5, 7, 9, 11, 13, 15, 0, 2, 4, 6, 8, 10, 12, 13],
      },
      serialPort: {
        path: usbSerialPath,
      },
      databasePath: dataPath("zigbee-database.db"),
      databaseBackupPath: dataPath("zigbee-database.db.backup"),
      backupPath: dataPath("zigbee-coordinator-backup.json"),
      adapter: {
        disableLED: false,
      },
      acceptJoiningDeviceHandler: async () => true,
    });
    this.herdsman.on("message", async (data) => {
      const device = await this.resolveDevice(data.device.ieeeAddr);
      if (!device) {
        return;
      }
      this.emit("message", {
        type: data.type,
        device,
      });
    });
    this.herdsman.on("deviceInterview", async (data) => {
      const device = this.resolveInternalDevice(data.device.ieeeAddr);
      if (!device) return;
      const d = { device, status: data.status };
      this.logDeviceInterview(d);
      await this.resolveDevice(data.device.ieeeAddr);
    });

    this.readyPromise = new Promise((resolve) => {
      this.setReady = resolve;
    });
    this.boot().catch((error) => {
      this.emit("error", error);
    });
  }

  async boot() {
    await this.herdsman.start();
    for (const herdsmanDevice of this.herdsman.getDevicesIterator()) {
      await this.resolveDevice(herdsmanDevice.ieeeAddr);
    }
    this.setReady();
  }

  enableJoin() {
    this.readyPromise.then(() => {
      this.herdsman.permitJoin(true, undefined, 600);
    });
  }

  disableJoin() {
    this.readyPromise.then(() => {
      this.herdsman.permitJoin(false);
    });
  }

  async *getDevices() {
    for (const herdsmanDevice of this.herdsman.getDevicesIterator()) {
      const device = await this.resolveDevice(herdsmanDevice.ieeeAddr);
      if (device) {
        yield device;
      }
    }
  }

  private resolveInternalDevice(
    ieeeAddr: string,
  ): InternalZigbeeDevice | undefined {
    if (!this.internlDeviceLookup[ieeeAddr]) {
      const device = this.herdsman.getDeviceByIeeeAddr(ieeeAddr);
      if (device) {
        this.internlDeviceLookup[ieeeAddr] = new InternalZigbeeDevice(device);
      }
    }

    const device = this.internlDeviceLookup[ieeeAddr];
    if (device && !device.zh.isDeleted) {
      return device;
    }

    return undefined;
  }

  private async resolveDevice(
    ieeeAddr: string,
  ): Promise<ZigbeeDevice | undefined> {
    const existingDevice = this.deviceLookup[ieeeAddr];
    if (existingDevice) {
      return existingDevice;
    }

    const internalDevice = this.resolveInternalDevice(ieeeAddr);
    if (!internalDevice) {
      return undefined;
    }
    await internalDevice.resolveDefinition();
    const { definition } = internalDevice;
    if (!internalDevice.isSupported || !definition) {
      return undefined;
    }
    if (Array.isArray(definition.exposes)) {
      for (const expose of definition.exposes) {
        if (expose.type === "enum" && expose.name === "action") {
          const device = new ZigbeeButton(internalDevice, definition);
          this.deviceLookup[ieeeAddr] = device;
          this.emit("device", device);
          return device;
        }
      }
    }
    return undefined;
  }

  private logDeviceInterview(data: {
    device: InternalZigbeeDevice;
    status: "started" | "successful" | "failed";
  }): void {
    const name = data.device.defaultName;
    if (data.status === "successful") {
      logger.info(
        `Successfully interviewed '${name}', device has successfully been paired`,
      );

      if (data.device.isSupported) {
        const { vendor, description, model } = data.device.definition ?? {};
        logger.info(
          `Device '${name}' is supported, identified as: ${vendor} ${description} (${model})`,
        );
      } else {
        logger.warn(
          `Device '${name}' with Zigbee model '${data.device.zh.modelID}' and manufacturer name ` +
            `'${data.device.zh.manufacturerName}' is NOT supported, ` +
            `please follow https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html`,
        );
      }
    } else if (data.status === "failed") {
      logger.error(
        `Failed to interview '${name}', device has not successfully been paired`,
      );
    } else {
      // data.status === 'started'
      logger.info(`Starting interview of '${name}'`);
    }
  }

  async close() {
    await this.herdsman.stop();
  }
}
