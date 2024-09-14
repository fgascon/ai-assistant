import dgram from "node:dgram";
import EventEmitter from "node:events";
import { XorEncryption } from "./xorencryption";
import { createDevice, Device } from "./devices";

const DISCOVERY_PORT = 9999;
const DISCOVERY_QUERY = {
  system: { get_sysinfo: null },
};
const DISCOVERY_PORT_2 = 20002;
/*const DISCOVERY_QUERY_2 = Buffer.from(
  "020000010000000000000000463cb5d3",
  "hex",
);*/

type DiscoveryEvents = {
  device: [Device];
  error: [Error];
};

export class Discovery extends EventEmitter<DiscoveryEvents> {
  private seenHosts = new Set<string>();
  private transport: Promise<dgram.Socket> | undefined;

  private async createTransport() {
    const transport = dgram.createSocket("udp4");
    transport.on("message", (data, remoteInfo) => {
      try {
        const ip = remoteInfo.address;
        const port = remoteInfo.port;
        if (this.seenHosts.has(ip)) {
          return;
        }
        this.seenHosts.add(ip);

        if (port === DISCOVERY_PORT) {
          const device = createDevice({ ip, port, data });
          if (device) {
            this.emit("device", device);
          }
        } else if (port === DISCOVERY_PORT_2) {
          this.emit("error", new Error("Discovery2 not implemented"));
        } else {
          this.emit("error", new Error(`Unknown port: ${port}`));
        }
      } catch (error) {
        this.emit(
          "error",
          error instanceof Error
            ? error
            : new Error(`Discovery error: ${error}`, { cause: error }),
        );
      }
    });
    transport.on("error", (error) => {
      this.emit("error", error);
    });
    transport.on("close", () => {
      this.transport = undefined;
    });
    await new Promise<void>((resolve) => transport.bind(0, () => resolve()));

    transport.setBroadcast(true);

    return transport;
  }

  async connect() {
    if (!this.transport) {
      this.transport = this.createTransport();
    }
    return await this.transport;
  }

  async close() {
    if (this.transport) {
      const transport = await this.transport;
      await new Promise<void>((resolve) => transport.close(resolve));
      this.transport = undefined;
    }
  }

  [Symbol.asyncDispose]() {
    return this.close();
  }

  async discover(options?: { targetAddress?: string }) {
    const targetAddress = options?.targetAddress || "255.255.255.255";
    if (this.seenHosts.has(targetAddress)) {
      return;
    }

    const transport = await this.connect();
    const encryptedReq = XorEncryption.encrypt(JSON.stringify(DISCOVERY_QUERY));
    transport.send(encryptedReq.slice(4), DISCOVERY_PORT, targetAddress);
    //transport.send(DISCOVERY_QUERY_2, DISCOVERY_PORT_2, targetAddress);
  }
}
