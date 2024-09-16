import net from "node:net";
import EventEmitter from "node:events";
import { XorEncryption } from "./xorencryption";

type IotTransportEvents = {
  error: [Error];
};

const BLOCK_SIZE = 4;

export class IotTransport extends EventEmitter<IotTransportEvents> {
  private ip: string;
  private port: number;

  constructor(config: { ip: string; port: number }) {
    super();
    this.ip = config.ip;
    this.port = config.port;
  }

  private async executeQuery(request: Uint8Array) {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection(
        {
          host: this.ip,
          port: this.port,
          timeout: 5000,
          noDelay: true,
        },
        () => {
          socket.removeListener("error", reject);
          resolve(socket);
        },
      );
      socket.on("error", reject);
    });

    return new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const handleData = (chunk: Buffer) => {
        chunks.push(chunk);
      };
      socket.once("error", (error) => {
        socket.destroy();
        reject(error);
      });
      socket.on("data", handleData);
      socket.on("close", () => {
        resolve(Buffer.concat(chunks).subarray(BLOCK_SIZE));
      });
      socket.end(request);
    });
  }

  async query(request: unknown): Promise<unknown> {
    console.log(`Sending request to ${this.ip}:${this.port}:`, request);
    const encryptedRequest = XorEncryption.encrypt(JSON.stringify(request));
    const result = await this.executeQuery(encryptedRequest);
    const decryptedResult = XorEncryption.decrypt(result);
    const parsedResult = JSON.parse(decryptedResult) as unknown;
    console.log(
      `Received response from ${this.ip}:${this.port}:`,
      parsedResult,
    );
    return parsedResult;
  }
}
