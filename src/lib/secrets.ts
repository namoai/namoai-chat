import fs from "fs";
import path from "path";

const runtimePath = path.join(process.cwd(), "secrets", "runtime.json");

let secrets: Record<string, string> = {};
if (fs.existsSync(runtimePath)) {
  try {
    const content = fs.readFileSync(runtimePath, "utf8");
    if (content && content.trim()) {
      secrets = JSON.parse(content);
    }
  } catch (error) {
    console.warn("⚠️ Failed to parse secrets/runtime.json:", error);
  }
}

export default secrets;
