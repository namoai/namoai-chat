// src/lib/secrets-loader.ts
import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "secrets", "runtime.json");
if (fs.existsSync(p)) {
  try {
    const content = fs.readFileSync(p, "utf8");
    if (content && content.trim()) {
      const obj = JSON.parse(content);
      for (const [k, v] of Object.entries(obj)) {
        if (!process.env[k]) process.env[k] = String(v);
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to parse secrets/runtime.json:", error);
  }
} else {
  console.warn("⚠️ secrets/runtime.json not found — skipping secrets load");
}