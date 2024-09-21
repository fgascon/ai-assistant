import "dotenv/config";
import { deviceManager } from "./iot";
import { configureLogger, logger } from "./observability/logger";

configureLogger({
  level: "debug",
  destination: 1,
});

process.on("SIGINT", async () => {
  deviceManager
    .close()
    .catch((error) => {
      logger.error("Failed to close device manager", { error });
    })
    .finally(() => {
      process.exit(0);
    });
});

if (process.env.PAIRING === "enabled") {
  deviceManager.enablePairing();
}
