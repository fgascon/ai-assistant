import EventEmitter from "node:events";
import * as zh from "zigbee-herdsman";
import { resolveRootPath } from "../../utils/path";
import { logger } from "../../observability/logger";
import type { DeviceType } from "./zh-types";
import Device from "./model/device";
import { setLogger } from "./logger";

setLogger();

type HerdsmanExport = {
  default: {
    Controller: typeof zh.Controller;
  };
};

export type ZigbeeDevice = {
  ieeeAddr: string;
  description: string;
  type: DeviceType;
  vendor: string;
  model: string;
};

type ZigbeeControllerEvents = {
  message: [{ type: string; device: ZigbeeDevice }];
  error: [unknown];
};

export class ZigbeeController extends EventEmitter<ZigbeeControllerEvents> {
  private herdsman: zh.Controller;
  private deviceLookup: { [s: string]: Device } = {};

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
      databasePath: resolveRootPath("zigbee/database.db"),
      databaseBackupPath: resolveRootPath("zigbee/database.db.backup"),
      backupPath: resolveRootPath("zigbee/coordinator_backup.json"),
      adapter: {
        disableLED: false,
      },
      acceptJoiningDeviceHandler: async () => true,
    });
    this.herdsman.on("message", async (data) => {
      const device = this.resolveDevice(data.device.ieeeAddr);
      if (!device) {
        return;
      }
      await device.resolveDefinition();
      if (device.isSupported && device.definition) {
        this.emit("message", {
          type: data.type,
          device: {
            ieeeAddr: device.ieeeAddr,
            description: device.definition.description,
            type: device.zh.type,
            vendor: device.definition.vendor,
            model: device.definition.model,
          },
        });
      }
    });
    this.herdsman.on("deviceInterview", async (data) => {
      const device = this.resolveDevice(data.device.ieeeAddr);
      if (!device) return; // Prevent potential race
      await device.resolveDefinition();
      const d = { device, status: data.status };
      this.logDeviceInterview(d);
    });

    this.herdsman.start().catch((error) => {
      this.emit("error", error);
    });
  }

  enableJoin() {
    this.herdsman.permitJoin(true, undefined, 600);
    console.log("permitted join");
  }

  disableJoin() {
    this.herdsman.permitJoin(false);
    console.log("disabled join");
  }

  private resolveDevice(ieeeAddr: string): Device | undefined {
    if (!this.deviceLookup[ieeeAddr]) {
      const device = this.herdsman.getDeviceByIeeeAddr(ieeeAddr);
      if (device) {
        this.deviceLookup[ieeeAddr] = new Device(device);
      }
    }

    const device = this.deviceLookup[ieeeAddr];
    if (device && !device.zh.isDeleted) {
      device.ensureInSettings();
      return device;
    }

    return undefined;
  }

  private logDeviceInterview(data: {
    device: Device;
    status: "started" | "successful" | "failed";
  }): void {
    const name = data.device.name;
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
