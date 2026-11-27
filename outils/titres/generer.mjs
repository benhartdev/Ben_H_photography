// Ouvre l'atelier de titres dans Edge, récupère les images et les enregistre.
// node gen.mjs <url atelier> <dossier de sortie>
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [url, outDir] = process.argv.slice(2);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9900 + Math.floor(Math.random() * 90);
const prof = join(process.env.TEMP || ".", `edgegen${port}`);
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 150; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === "page")) break; } catch {}
  await sleep(200);
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable");
await send("Page.navigate", { url });
await sleep(4000);
const r = await send("Runtime.evaluate", { expression: "generer()", awaitPromise: true, returnByValue: true });
const out = r.result?.result?.value;
if (!out || out.erreur) { console.log("ERREUR", out?.erreur || JSON.stringify(r.result).slice(0, 300)); }
else {
  mkdirSync(outDir, { recursive: true });
  for (const [name, dataUrl] of Object.entries(out)) {
    const buf = Buffer.from(dataUrl.split(",")[1], "base64");
    writeFileSync(join(outDir, name), buf);
    console.log("écrit", name, Math.round(buf.length / 1024), "Ko");
  }
}
ws.close(); edge.kill(); process.exit(0);
