import * as path from "node:path";
import { requireEnvVar } from "../config";

const dataDirPath = path.resolve(process.cwd(), requireEnvVar("DATA_PATH"));

export function dataPath(relativePath: string): string {
  return path.resolve(dataDirPath, relativePath);
}
