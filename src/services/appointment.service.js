import {
  createAppointment,
  getAppointments,
  getAppointmentsByPhone,
  getAppointmentsByName,
  cancelAppointment,
  createLead,
  getLeads,
  getLeadByEmail,
  saveCostEstimate,
} from "./database.service.js";

// ==================== PRICING DATA ====================
const PRICING = {
  project_costs: {
    basic: { min: "₹1L", max: "₹3L", description: "Basic project with standard features" },
    medium: { min: "₹3L", max: "₹8L", description: "Medium complexity with custom features" },
    advanced: { min: "₹8L", max: "₹20L", description: "Advanced/AI project with complex integrations" },
    enterprise: { min: "₹20L", max: "₹50L+", description: "Enterprise platform with full customization" },
  },
  mvp_packages: {
    starter: { cost: "₹1.5L", features: "Core features, basic UI, 2-4 weeks delivery" },
    growth: { cost: "₹3L", features: "Advanced features, APIs, 4-6 weeks delivery" },
    ai_mvp: { cost: "₹5L+", features: "AI models, automation, 6-8 weeks delivery" },
  },
  hiring_rates: {
    hourly: "₹1500/hour",
    monthly: "₹1.8L/developer",
    dedicated_team: "Custom pricing based on team size",
  },
  technologies: [".NET/.NET Core", "React/Next.js", "Node.js", "PHP/Laravel", "Python/AI-ML", "Sitecore CMS"],
};

// ==================== TOOL DEFINITIONS ====================
export const toolDefinitions = [
  {
    name: "capture_lead",
    description: "Capture lead information when user shows interest. Required: name and email. Use this to save potential customer details.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name of the person" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number (optional)" },
        company: { type: "string", description: "Company name (optional)" },
        service_interest: { type: "string", description: "Service they're interested in" },
        inquiry: { type: "string", description: "Brief description of their requirement" },
      },
      required: ["name", "email"],
    },
  },
  {
    name: "get_cost_estimate",
    description: "Provide project cost estimation based on type and complexity.",
    parameters: {
      type: "object",
      properties: {
        project_type: {
          type: "string",
          enum: ["mvp", "business_automation", "enterprise", "ai_solution", "cms_website", "mobile_app", "custom_software"],
          description: "Type of project",
        },
        complexity: {
          type: "string",
          enum: ["basic", "medium", "advanced", "enterprise"],
          description: "Feature complexity level",
        },
      },
      required: ["project_type", "complexity"],
    },
  },
  {
    name: "get_hiring_rates",
    description: "Provide developer hiring costs based on technology and engagement model.",
    parameters: {
      type: "object",
      properties: {
        technology: {
          type: "string",
          description: "Technology stack needed (e.g., React, Node.js, .NET, Python)",
        },
        engagement_model: {
          type: "string",
          enum: ["hourly", "monthly", "dedicated_team"],
          description: "Hiring model preference",
        },
      },
      required: ["technology", "engagement_model"],
    },
  },
  {
    name: "get_mvp_packages",
    description: "Show available MVP development packages with pricing.",
    parameters: {
      type: "object",
      properties: {
        include_ai: { type: "boolean", description: "Include AI MVP package details" },
      },
      required: [],
    },
  },
  {
    name: "schedule_meeting",
    description: "Schedule a meeting/call with the team. Required: name, phone/email, date, time.",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Full name of the person" },
        client_phone: { type: "string", description: "Phone number" },
        client_email: { type: "string", description: "Email address" },
        company_name: { type: "string", description: "Company name (optional)" },
        meeting_type: {
          type: "string",
          enum: ["sales_consultant", "technical_expert", "cto_discussion"],
          description: "Type of meeting",
        },
        meeting_date: { type: "string", description: "Preferred date" },
        meeting_time: { type: "string", description: "Preferred time" },
        purpose: { type: "string", description: "Brief purpose of meeting" },
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
    name: "cancel_appointment",
    description: "Cancel an existing appointment by ID.",
    parameters: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "Appointment ID to cancel" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "get_services_list",
    description: "Get list of all services offered by the company.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ==================== TOOL IMPLEMENTATIONS ====================
const tools = {
  async capture_lead(botId, sessionId, args) {
    console.log("\n   📋 LEAD CAPTURE FLOW");
    
    // Check if lead already exists
    const existingLead = await getLeadByEmail(botId, args.email);
    if (existingLead) {
      console.log(`   ℹ️ Lead already exists: ${existingLead.id}`);
      return {
        success: true,
        existing: true,
        message: `Welcome back! We have your details on file.`,
        lead_id: existingLead.id,
      };
    }

    const lead = await createLead(botId, sessionId, args);
    
    return {
      success: true,
      lead_id: lead.id.slice(0, 8).toUpperCase(),
      message: `Thank you ${args.name}! Your inquiry has been recorded. Our team will reach out soon.`,
      next_step: "Would you like to schedule a call with our expert?",
    };
  },

  async get_cost_estimate(botId, sessionId, args) {
    console.log("\n   💰 COST ESTIMATION FLOW");
    console.log(`   Project Type: ${args.project_type}`);
    console.log(`   Complexity: ${args.complexity}`);

    const pricing = PRICING.project_costs[args.complexity] || PRICING.project_costs.medium;
    
    let estimate = {
      project_type: args.project_type,
      complexity: args.complexity,
      range: `${pricing.min} - ${pricing.max}`,
      description: pricing.description,
    };

    // Add specific details based on project type
    if (args.project_type === "mvp") {
      estimate.packages = PRICING.mvp_packages;
      estimate.note = "For MVPs, we offer fixed-cost packages with guaranteed delivery timelines.";
    } else if (args.project_type === "ai_solution") {
      estimate.note = "AI projects require detailed scope analysis. Includes ML model development, training, and deployment.";
    } else if (args.project_type === "enterprise") {
      estimate.note = "Enterprise solutions include multi-tenant architecture, security compliance, and dedicated support.";
    }

    // Save estimate to DB
    await saveCostEstimate(botId, sessionId, {
      project_type: args.project_type,
      complexity: args.complexity,
      estimated_cost: estimate.range,
      details: JSON.stringify(estimate),
    });

    return {
      success: true,
      estimate,
      message: `Based on ${args.complexity} complexity for ${args.project_type.replace(/_/g, " ")}, estimated cost is ${estimate.range}`,
      cta: "For detailed estimation, please share your requirements or schedule a call.",
    };
  },

  async get_hiring_rates(botId, sessionId, args) {
    console.log("\n   👨‍💻 HIRING RATES FLOW");
    console.log(`   Technology: ${args.technology}`);
    console.log(`   Model: ${args.engagement_model}`);

    const rate = PRICING.hiring_rates[args.engagement_model];
    
    return {
      success: true,
      technology: args.technology,
      engagement_model: args.engagement_model,
      rate: rate,
      available_technologies: PRICING.technologies,
      benefits: [
        "Direct communication with developer",
        "Daily/weekly progress reports",
        "Dedicated project manager",
        "Flexible scaling up/down",
        "NDA & IP protection",
      ],
      message: `For ${args.technology} developer on ${args.engagement_model.replace(/_/g, " ")} basis: ${rate}`,
      cta: "Would you like to schedule a developer interview?",
    };
  },

  async get_mvp_packages(botId, sessionId, args) {
    console.log("\n   📦 MVP PACKAGES FLOW");

    const packages = [
      { name: "Starter MVP", ...PRICING.mvp_packages.starter },
      { name: "Growth MVP", ...PRICING.mvp_packages.growth },
    ];

    if (args.include_ai !== false) {
      packages.push({ name: "AI MVP", ...PRICING.mvp_packages.ai_mvp });
    }

    return {
      success: true,
      packages,
      benefits: [
        "Fixed cost - no surprises",
        "Fast delivery (2-8 weeks)",
        "Scalable architecture",
        "Post-launch support",
        "Source code ownership",
      ],
      message: "Our MVP packages are designed for startups to launch quickly.",
      cta: "Which package interests you? I can help you choose the right one.",
    };
  },

  async schedule_meeting(botId, sessionId, args) {
    console.log("\n   📅 MEETING SCHEDULING FLOW");
    
    const required = ["client_name", "client_phone", "meeting_date", "meeting_time"];
    const missing = required.filter(f => !args[f]);

    if (missing.length > 0) {
      return { 
        success: false, 
        error: `Missing information: ${missing.join(", ")}`,
        missing_fields: missing,
      };
    }

    const meetingTypeLabels = {
      sales_consultant: "Sales Consultant",
      technical_expert: "Technical Expert",
      cto_discussion: "CTO Discussion",
    };

    const appointment = await createAppointment(botId, {
      client_name: args.client_name,
      client_phone: args.client_phone,
      client_email: args.client_email || null,
      company_name: args.company_name || null,
      meeting_type: args.meeting_type || "sales_consultant",
      meeting_date: args.meeting_date,
      meeting_time: args.meeting_time,
      purpose: args.purpose || "Project Discussion",
      contact_person: meetingTypeLabels[args.meeting_type] || "Team",
    });

    return {
      success: true,
      booking: {
        id: appointment.id.slice(0, 8).toUpperCase(),
        name: args.client_name,
        type: meetingTypeLabels[args.meeting_type] || "General",
        date: args.meeting_date,
        time: args.meeting_time,
      },
      message: `✅ Meeting scheduled successfully!\n\n📋 Booking ID: ${appointment.id.slice(0, 8).toUpperCase()}\n📅 Date: ${args.meeting_date}\n⏰ Time: ${args.meeting_time}\n👤 With: ${meetingTypeLabels[args.meeting_type] || "Our Team"}`,
      confirmation: "You'll receive email & WhatsApp confirmation shortly.",
    };
  },

  async search_appointments(botId, sessionId, args) {
    console.log("\n   🔍 APPOINTMENT SEARCH FLOW");
    
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
        type: apt.meeting_type || "General",
        purpose: apt.purpose || "Discussion",
        status: apt.status,
      })),
      count: appointments.length,
    };
  },

  async cancel_appointment(botId, sessionId, args) {
    console.log("\n   ❌ APPOINTMENT CANCELLATION FLOW");
    
    const allAppointments = await getAppointments(botId);
    const appointment = allAppointments.find(
      apt => apt.id === args.appointment_id || 
             apt.id.toLowerCase().startsWith(args.appointment_id.toLowerCase())
    );

    if (!appointment) {
      return { success: false, error: "Appointment not found" };
    }

    await cancelAppointment(appointment.id);
    return { 
      success: true, 
      message: `Meeting for ${appointment.client_name} on ${appointment.meeting_date} has been cancelled.`,
    };
  },

  async get_services_list(botId, sessionId, args) {
    console.log("\n   📋 SERVICES LIST FLOW");
    
    return {
      success: true,
      services: [
        {
          category: "Software Development",
          items: ["Custom Software/ERP/CRM", "Web Applications", "Mobile Apps", "API Development"],
        },
        {
          category: "AI & Automation",
          items: ["AI Chatbots", "Process Automation", "AI Analytics", "OCR/NLP Solutions"],
        },
        {
          category: "MVP Development",
          items: ["Starter MVP (₹1.5L)", "Growth MVP (₹3L)", "AI MVP (₹5L+)"],
        },
        {
          category: "Enterprise Solutions",
          items: ["Multi-tenant Platforms", "Security & Compliance", "Cloud Deployment"],
        },
        {
          category: "CMS & Sitecore",
          items: ["Sitecore Development", "Headless CMS", "AI Personalization", "Migration"],
        },
        {
          category: "Support Services",
          items: ["Bug Fixes", "Code Review", "Performance Optimization", "24/7 Support"],
        },
      ],
      message: "Here are all services we offer at Murmu Software Infotech.",
    };
  },
};

// ==================== TOOL EXECUTOR ====================
export async function executeTool(botId, sessionId, toolName, args) {
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
  const result = await tool(botId, sessionId, args);
  const duration = Date.now() - startTime;

  console.log(`\n   📤 Output (${duration}ms):`);
  console.log(`      Success: ${result.success ? "✅" : "❌"}`);
  if (result.message) {
    console.log(`      Message: ${result.message.substring(0, 80)}...`);
  }
  if (result.booking) {
    console.log(`      Booking ID: ${result.booking.id}`);
  }
  if (result.lead_id) {
    console.log(`      Lead ID: ${result.lead_id}`);
  }
  if (result.estimate) {
    console.log(`      Estimate: ${result.estimate.range}`);
  }
  if (result.error) {
    console.log(`      Error: ${result.error}`);
  }

  return result;
}

export default { toolDefinitions, executeTool };
