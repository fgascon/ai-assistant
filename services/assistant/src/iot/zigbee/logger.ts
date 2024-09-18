import * as zh from "zigbee-herdsman";
import * as zhc from "zigbee-herdsman-converters";
import { logger } from "../../observability/logger";

type Logger = Parameters<typeof zh.setLogger>[0];

const zhLogger: Logger = {
  debug(message, namespace) {
    logger.debug(`[${namespace}] ${message}`);
  },
  info(message, namespace) {
    logger.info(`[${namespace}] ${message}`);
  },
  warning(message, namespace) {
    logger.warn(`[${namespace}] ${message}`);
  },
  error(message, namespace) {
    logger.error(`[${namespace}] ${message}`);
  },
};

export function setLogger() {
  zh.setLogger(zhLogger);
  zhc.setLogger(zhLogger);
}
