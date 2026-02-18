import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const candidatePaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), "../../../.env"),
];

for (const path of candidatePaths) {
  if (!existsSync(path)) continue;
  config({ path });
  break;
}
