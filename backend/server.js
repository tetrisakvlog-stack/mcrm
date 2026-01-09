import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;

app.post("/api/cloudtalk/call", async (req, res) => {
  try {
    const { agent_id, callee_number } = req.body || {};
    if (!agent_id || !callee_number) return res.status(400).send("Missing agent_id or callee_number");

    const keyId = process.env.CT_KEY_ID;
    const keySecret = process.env.CT_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).send("Missing CT_KEY_ID/CT_KEY_SECRET");

    const basic = Buffer.from(keyId + ":" + keySecret).toString("base64");

    const r = await fetch("https://my.cloudtalk.io/api/calls/create.json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": "Basic " + basic,
      },
      body: JSON.stringify({ agent_id, callee_number }),
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).send(text);
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
});

app.get("/", (_, res) => res.status(200).send("ok"));
app.listen(PORT, () => console.log(`Backend on http://localhost:${PORT}`));
