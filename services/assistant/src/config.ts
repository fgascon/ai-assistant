export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function readHexEnvVar(name: string): string | undefined {
  const string = process.env[name];
  if (!string) {
    return undefined;
  }
  const number = parseInt(string);
  if (isNaN(number)) {
    return undefined;
  }
  return number.toString(16);
}

export function getZigbeeConfig() {
  const vid = readHexEnvVar("ZIGBEE_VID");
  const pid = readHexEnvVar("ZIGBEE_PID");
  if (!vid || !pid) {
    return undefined;
  }
  return { vid, pid };
}

export const zigbeeConfig = getZigbeeConfig();
