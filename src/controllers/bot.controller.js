import { createBot, getBotById } from "../services/database.service.js";

export async function create(req, res) {
  try {
    const { name, website } = req.body;
    const botId = await createBot(name || "My Bot", website);
    res.json({ botId, message: "Bot created successfully" });
  } catch (error) {
    console.error("Create bot error:", error);
    res.status(500).json({ error: "Failed to create bot" });
  }
}

export async function getInfo(req, res) {
  try {
    const bot = await getBotById(req.params.botId);
    if (!bot) {
      return res.status(404).json({ error: "Bot not found" });
    }
    res.json(bot);
  } catch (error) {
    console.error("Get bot error:", error);
    res.status(500).json({ error: "Failed to get bot info" });
  }
}

export default { create, getInfo };

