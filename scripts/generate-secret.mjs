import fs from "node:fs";
import crypto from "node:crypto";

const path = ".env.local";
let content = fs.readFileSync(path, "utf8");
content = content.replace(
  /^AUTH_SECRET=".*"$/m,
  `AUTH_SECRET="${crypto.randomBytes(32).toString("hex")}"`,
);
fs.writeFileSync(path, content);
