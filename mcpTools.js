/**
 * MCP Tools for Appointment Booking System
 * Works with doctors from uploaded PDF documents
 */

import {
  createAppointment,
  getAppointmentById,
  getAppointments,
  getAppointmentsByPhone,
  getAppointmentsByName,
  cancelAppointment,
} from "./db.js";

// Tool definitions for Gemini function calling
export const toolDefinitions = [
  {
    name: "book_appointment",
    description: "Book an appointment with a doctor. Use this ONLY when you have ALL required patient details: name, phone, age, gender, preferred date and time, and doctor name.",
    parameters: {
      type: "object",
      properties: {
        doctor_name: {
          type: "string",
          description: "Name of the doctor to book with (from the document)"
        },
        patient_name: {
          type: "string",
          description: "Full name of the patient"
        },
        patient_phone: {
          type: "string",
          description: "Patient's phone number (10 digits)"
        },
        patient_age: {
          type: "integer",
          description: "Patient's age in years"
        },
        patient_gender: {
          type: "string",
          description: "Patient's gender (Male/Female/Other)"
        },
        appointment_date: {
          type: "string",
          description: "Preferred date for appointment (e.g., '2024-01-15' or 'tomorrow' or 'next Monday')"
        },
        appointment_time: {
          type: "string",
          description: "Preferred time for appointment (e.g., '10:00 AM', 'morning', 'afternoon')"
        },
        patient_symptoms: {
          type: "string",
          description: "Patient's symptoms or reason for visit (optional)"
        }
      },
      required: ["doctor_name", "patient_name", "patient_phone", "patient_age", "patient_gender", "appointment_date", "appointment_time"]
    }
  },
  {
    name: "search_appointments",
    description: "Search and retrieve appointments. Use this when user wants to check, find, or view their appointments. Can search by phone number or patient name.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Phone number to search appointments for"
        },
        name: {
          type: "string",
          description: "Patient name to search appointments for"
        }
      },
      required: []
    }
  },
  {
    name: "get_all_appointments",
    description: "Get list of all appointments. Use when user asks for all bookings or complete appointment list.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "cancel_appointment",
    description: "Cancel an existing appointment by appointment ID.",
    parameters: {
      type: "object",
      properties: {
        appointment_id: {
          type: "string",
          description: "The appointment ID to cancel"
        }
      },
      required: ["appointment_id"]
    }
  }
];

// Tool implementations
export const mcpTools = {
  /**
   * Book an appointment
   */
  async book_appointment(botId, args) {
    try {
      const required = ['doctor_name', 'patient_name', 'patient_phone', 'patient_age', 'patient_gender', 'appointment_date', 'appointment_time'];
      const missing = required.filter(f => !args[f]);
      
      if (missing.length > 0) {
        return { 
          success: false, 
          error: `Missing required information: ${missing.join(', ')}`,
          missing_fields: missing
        };
      }

      const appointment = await createAppointment(botId, {
        doctor_name: args.doctor_name,
        patient_name: args.patient_name,
        patient_phone: args.patient_phone,
        patient_email: args.patient_email || null,
        patient_age: args.patient_age,
        patient_gender: args.patient_gender,
        patient_symptoms: args.patient_symptoms || null,
        appointment_date: args.appointment_date,
        appointment_time: args.appointment_time
      });

      return {
        success: true,
        appointment: {
          id: appointment.id,
          doctor_name: args.doctor_name,
          patient_name: args.patient_name,
          patient_phone: args.patient_phone,
          date: args.appointment_date,
          time: args.appointment_time
        },
        message: `Appointment booked successfully! ID: ${appointment.id.slice(0, 8)}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Search appointments by phone or name
   */
  async search_appointments(botId, args) {
    try {
      let appointments = [];
      
      if (args.phone) {
        appointments = await getAppointmentsByPhone(botId, args.phone);
      } else if (args.name) {
        appointments = await getAppointmentsByName(botId, args.name);
      } else {
        // If no filter, get all
        appointments = await getAppointments(botId);
      }
      
      if (appointments.length === 0) {
        return {
          success: true,
          appointments: [],
          count: 0,
          message: args.phone 
            ? `No appointments found for phone number ${args.phone}` 
            : args.name 
              ? `No appointments found for ${args.name}`
              : "No appointments found."
        };
      }

      return {
        success: true,
        appointments: appointments.map(apt => ({
          id: apt.id,
          appointment_id: apt.id.slice(0, 8),
          doctor_name: apt.doctor_name,
          patient_name: apt.patient_name,
          patient_phone: apt.patient_phone,
          patient_age: apt.patient_age,
          patient_gender: apt.patient_gender,
          date: apt.appointment_date,
          time: apt.appointment_time,
          symptoms: apt.patient_symptoms,
          status: apt.status,
          booked_on: apt.created_at
        })),
        count: appointments.length,
        message: `Found ${appointments.length} appointment(s)`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all appointments
   */
  async get_all_appointments(botId, args) {
    try {
      const appointments = await getAppointments(botId);
      
      if (appointments.length === 0) {
        return {
          success: true,
          appointments: [],
          count: 0,
          message: "No appointments found."
        };
      }

      return {
        success: true,
        appointments: appointments.map(apt => ({
          id: apt.id,
          appointment_id: apt.id.slice(0, 8),
          doctor_name: apt.doctor_name,
          patient_name: apt.patient_name,
          patient_phone: apt.patient_phone,
          date: apt.appointment_date,
          time: apt.appointment_time,
          status: apt.status
        })),
        count: appointments.length,
        message: `Found ${appointments.length} appointment(s)`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Cancel an appointment
   */
  async cancel_appointment(botId, args) {
    try {
      // Try to find by partial ID match
      const allAppointments = await getAppointments(botId);
      const appointment = allAppointments.find(apt => 
        apt.id === args.appointment_id || 
        apt.id.startsWith(args.appointment_id)
      );
      
      if (!appointment) {
        return { success: false, error: "Appointment not found with that ID" };
      }
      
      const cancelled = await cancelAppointment(appointment.id);
      if (!cancelled) {
        return { success: false, error: "Could not cancel appointment" };
      }

      return {
        success: true,
        message: `Appointment cancelled successfully. Doctor: ${appointment.doctor_name}, Date: ${appointment.appointment_date}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

/**
 * Execute a tool call from Gemini
 */
export async function executeTool(botId, toolName, args) {
  const tool = mcpTools[toolName];
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  console.log(`🔧 Executing tool: ${toolName}`, args);
  const result = await tool(botId, args);
  console.log(`✅ Tool result:`, JSON.stringify(result, null, 2));
  
  return result;
}
