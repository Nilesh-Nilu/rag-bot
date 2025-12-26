import { getAppointments } from "../services/database.service.js";

export async function list(req, res) {
  try {
    const { botId } = req.params;
    const appointments = await getAppointments(botId);
    res.json({ appointments });
  } catch (error) {
    console.error("List appointments error:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
}

export default { list };

