export default async function handler(req, res) {
  // CORS (nutné pre browser fetch)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    // Vercel niekedy dá body ako string
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { agent_id, callee_number } = body;

    if (!agent_id || !callee_number) {
      return res.status(400).send("Missing agent_id or callee_number");
    }

    const keyId = process.env.CT_KEY_ID;
    const keySecret = process.env.CT_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.status(500).send("Missing CT_KEY_ID/CT_KEY_SECRET");
    }

    const basic = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const r = await fetch("https://my.cloudtalk.io/api/calls/create.json", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Basic " + basic,
      },
      body: JSON.stringify({ agent_id, callee_number }),
    });

    const text = await r.text();
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
}
