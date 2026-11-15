// Cuts the shot clips into out/firebreak-30s-silent.mp4 (30.0 s, 1920x1080, 30 fps, no audio).
//   node video/cut.mjs
// Edit SEGMENTS to change text or lengths.
import { writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const URL_TEXT = "flame-in-freefall.all-mites1.workers.dev";
const SEGMENTS = [
  { len: 4.0, card: "NASA has burned things in orbit and on Earth.\nNone ran in Moon gravity." },
  { len: 3.5, clip: "s1-console", cap: "Firebreak turns those experiments into answers for one habitat." },
  { len: 3.5, clip: "s2-pick-rank", cap: "Pick a base. Its air decides which experiments matter most." },
  { len: 3.5, clip: "s3-interpret", cap: "Read what the evidence means, and what it cannot tell you." },
  { len: 7.0, clip: "s4-fire", cap: "Start a fire in the cabin. Stop the ventilation. See what the records say happens next." },
  { len: 4.5, clip: "s5-ask-models", cap: "Ask a question. Every answer shows its sources, and every number comes from the data." },
  { len: 4.0, card: "Firebreak", sub: URL_TEXT, cap: "The evidence, ready before the crew is." },
];
const FONT = "C:/Windows/Fonts/segoeui.ttf";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "cut-"));
const fp = (p) => p.split(String.fromCharCode(92)).join("/").split(":").join(String.fromCharCode(92)+":");
let n = 0;
const txt = (s) => { const f = join(tmp, `t${n++}.txt`); writeFileSync(f, s); return fp(f); };
function wrap(s) {
  if (s.length <= 40) return s;
  const w = s.split(" "); let best = 1, bd = 1e9;
  for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length); if (d < bd) { bd = d; best = i; } }
  const l1 = w.slice(0, best).join(" "), l2 = w.slice(best).join(" ");
  if (Math.max(l1.length, l2.length) > 60) throw new Error("caption too long: " + s);
  return l1 + String.fromCharCode(10) + l2;
}
const dt = (file, size, y, extra = "") =>
  `drawtext=fontfile='${fp(FONT)}':textfile='${file}':fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${y}:line_spacing=10${extra}`;
const box = ":box=1:boxcolor=black@0.65:boxborderw=22";

const args = [], filters = [];
SEGMENTS.forEach((s, i) => {
  const L = s.len; let f;
  if (s.card) {
    args.push("-f", "lavfi", "-t", String(L), "-i", "color=c=black:s=1920x1080:r=30");
    f = s.sub
      ? [dt(txt(s.card), 120, "(h-text_h)/2-60"), dt(txt(s.sub), 40, "(h/2)+80")].join(",")
      : dt(txt(s.card), 64, "(h-text_h)/2");
    if (s.sub) f += "," + dt(txt(wrap(s.cap)), 44, "h-170");
  } else {
    args.push("-i", join(here, "out/shots", s.clip + ".mp4"));
    f = `fps=30,tpad=stop_mode=clone:stop_duration=${L},trim=duration=${L},setpts=PTS-STARTPTS,` + dt(txt(wrap(s.cap)), 44, "h-text_h-90", box);
  }
  filters.push(`[${i}:v]${f},scale=1920:1080:out_range=tv,setsar=1,format=yuv420p[v${i}]`);
});
const fc = filters.join(";") + ";" + SEGMENTS.map((_, i) => `[v${i}]`).join("") + `concat=n=${SEGMENTS.length}:v=1:a=0[out]`;
writeFileSync(join(tmp, "fc.txt"), fc);
const out = join(here, "out/firebreak-30s-silent.mp4");
const r = spawnSync("ffmpeg", ["-y", ...args, "-filter_complex_script", join(tmp, "fc.txt"), "-map", "[out]", "-an",
  "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", out], { stdio: "inherit" });
process.exit(r.status ?? 1);
