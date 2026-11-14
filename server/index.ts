import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.post("/rank", (c) => c.json({ error: "not_implemented", message: "POST /rank is not implemented yet" }, 501));
app.post("/verify", (c) => c.json({ error: "not_implemented", message: "POST /verify is not implemented yet" }, 501));

export default app;
