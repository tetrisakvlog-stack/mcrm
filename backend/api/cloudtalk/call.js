export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

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
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
}
