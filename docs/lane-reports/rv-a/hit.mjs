import { launch } from "./cdp.mjs";
const p = await launch();
await p.size(390, 844);
await p.go("http://localhost:5184/?lib=1&ask=0", 3000);
console.log(JSON.stringify(await p.eval(`(() => [...document.querySelectorAll(".lib-source")].slice(0, 3).map(li => { li.scrollIntoView({block:"center"}); const r = li.getBoundingClientRect(); const pts = [[r.left + 2, r.top + 2], [r.right - 2, r.bottom - 2]]; return { h: Math.round(r.height), hits: pts.map(([x, y]) => document.elementFromPoint(x, y)?.closest("a") === li.querySelector("a")) }; }))()`)));
const b = await p.eval(`(() => { const a = document.querySelector(".briefline-src a"); const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), a.textContent.slice(0, 20)]; })()`);
console.log("briefline link", JSON.stringify(b));
p.close();
