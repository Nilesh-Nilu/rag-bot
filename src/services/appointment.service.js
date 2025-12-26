import {
  createAppointment,
  getAppointments,
  getAppointmentsByPhone,
  getAppointmentsByName,
  cancelAppointment,
} from "./database.service.js";

// Tool definitions for OpenAI function calling
export const toolDefinitions = [
  {
    name: "book_appointment",
    description: "Book a meeting. Required: client name, phone, date, and time. Purpose defaults to 'Discussion'.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Full name of the person booking",
        },
        client_phone: {
          type: "string",
          description: "Phone number",
        },
        client_email: {
          type: "string",
          description: "Email address (optional)",
        },
        meeting_date: {
          type: "string",
          description: "Preferred date (e.g., 'tomorrow', '2024-01-15')",
        },
        meeting_time: {
          type: "string",
          description: "Preferred time (e.g., '10:00 AM', 'afternoon')",
        },
        purpose: {
          type: "string",
          description: "Purpose of meeting (optional, defaults to 'Discussion')",
        },
      },
      required: ["client_name", "client_phone", "meeting_date", "meeting_time"],
    },
  },
  {
    name: "search_appointments",
    description: "Search appointments by phone number or name.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone number to search" },
        name: { type: "string", description: "Name to search" },
      },
      required: [],
    },
  },
  {
    name: "get_all_appointments",
    description: "Get all scheduled appointments.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancel an appointment by ID.",
    parameters: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "Appointment ID to cancel" },
      },
      required: ["appointment_id"],
    },
  },
];

// Tool implementations
const tools = {
  async book_appointment(botId, args) {
    const required = ["client_name", "client_phone", "meeting_date", "meeting_time"];
    const missing = required.filter(f => !args[f]);

    if (missing.length > 0) {
      return { success: false, error: `Missing: ${missing.join(", ")}`, missing_fields: missing };
    }

    const appointment = await createAppointment(botId, {
      contact_person: "Team",
      client_name: args.client_name,
      client_phone: args.client_phone,
      client_email: args.client_email || null,
      meeting_date: args.meeting_date,
      meeting_time: args.meeting_time,
      purpose: args.purpose || "Discussion",
    });

    return {
      success: true,
      booking: {
        id: appointment.id.slice(0, 8).toUpperCase(),
        name: args.client_name,
        date: args.meeting_date,
        time: args.meeting_time,
      },
      message: `Meeting booked! ID: ${appointment.id.slice(0, 8).toUpperCase()}`,
    };
  },

  async search_appointments(botId, args) {
    let appointments = [];

    if (args.phone) {
      appointments = await getAppointmentsByPhone(botId, args.phone);
    } else if (args.name) {
      appointments = await getAppointmentsByName(botId, args.name);
    } else {
      appointments = await getAppointments(botId);
    }

    if (appointments.length === 0) {
      return { success: true, appointments: [], message: "No appointments found." };
    }

    return {
      success: true,
      appointments: appointments.map(apt => ({
        id: apt.id.slice(0, 8).toUpperCase(),
        client: apt.client_name,
        phone: apt.client_phone,
        date: apt.meeting_date,
        time: apt.meeting_time,
        purpose: apt.purpose || "Discussion",
        status: apt.status,
      })),
      count: appointments.length,
    };
  },

  async get_all_appointments(botId) {
    const appointments = await getAppointments(botId);

    if (appointments.length === 0) {
      return { success: true, appointments: [], message: "No appointments." };
    }

    return {
      success: true,
      appointments: appointments.map(apt => ({
        id: apt.id.slice(0, 8).toUpperCase(),
        client: apt.client_name,
        date: apt.meeting_date,
        time: apt.meeting_time,
        status: apt.status,
      })),
      count: appointments.length,
    };
  },

  async cancel_appointment(botId, args) {
    const allAppointments = await getAppointments(botId);
    const appointment = allAppointments.find(
      apt => apt.id === args.appointment_id || apt.id.toLowerCase().startsWith(args.appointment_id.toLowerCase())
    );

    if (!appointment) {
      return { success: false, error: "Appointment not found" };
    }

    await cancelAppointment(appointment.id);
    return { success: true, message: `Cancelled meeting for ${appointment.client_name}` };
  },
};

export async function executeTool(botId, toolName, args) {
  console.log("\n   ┌────────────────────────────────────────────┐");
  console.log(`   │  MCP TOOL: ${toolName.padEnd(30)} │`);
  console.log("   └────────────────────────────────────────────┘");
  
  const tool = tools[toolName];
  if (!tool) {
    console.log(`   ❌ Unknown tool: ${toolName}`);
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  console.log("   📥 Input arguments:");
  Object.entries(args).forEach(([key, value]) => {
    console.log(`      • ${key}: ${value}`);
  });

  console.log("\n   ⚙️ Executing tool logic...");
  const startTime = Date.now();
  const result = await tool(botId, args);
  const duration = Date.now() - startTime;

  console.log(`\n   📤 Output (${duration}ms):`);
  console.log(`      Success: ${result.success ? "✅" : "❌"}`);
  if (result.message) {
    console.log(`      Message: ${result.message}`);
  }
  if (result.booking) {
    console.log(`      Booking ID: ${result.booking.id}`);
  }
  if (result.appointments) {
    console.log(`      Appointments found: ${result.appointments.length}`);
  }
  if (result.error) {
    console.log(`      Error: ${result.error}`);
  }

  return result;
}

export default { toolDefinitions, executeTool };

