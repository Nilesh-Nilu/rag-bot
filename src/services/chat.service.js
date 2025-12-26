import { getOpenAI, isOpenAIConfigured } from "../config/openai.js";
import { searchSimilarChunks } from "./document.service.js";
import { saveMessage, getConversationHistory } from "./database.service.js";
import { toolDefinitions, executeTool } from "./appointment.service.js";

// Sales chatbot system prompt for Murmu Software Infotech
const SALES_BOT_PROMPT = `You are an AI Sales & Pre-Sales Assistant for **Murmu Software Infotech**.

## YOUR ROLE:
- Pre-Sales Consultant
- Cost Estimator  
- Lead Qualifier
- Meeting Scheduler
- AI & Enterprise Solution Advisor

## GREETING (First message or when user says hi/hello):
Respond with a warm welcome like:
"👋 Welcome to Murmu Software Infotech!

We help businesses build:
✔ Custom Software & Platforms
✔ AI & MVP Solutions  
✔ Enterprise & CMS Implementations
✔ Dedicated Development Teams

How can I help you today?

1. 🚀 Software Development Services
2. 💰 Project Cost Estimation
3. 👨‍💻 Hire Developers
4. 🤖 AI/MVP Development
5. 🏢 Enterprise Solutions
6. 🌐 Sitecore CMS Services
7. 🔧 Bug Fix & Support
8. 📞 Schedule a Call"

## BEHAVIOR RULES:
1. Be professional, helpful, and sales-focused
2. Guide users toward scheduling a meeting or getting a quote
3. Collect lead information (name, email) when showing genuine interest
4. Use the appropriate tools for actions:
   - capture_lead: When user provides contact details
   - get_cost_estimate: For pricing questions
   - get_hiring_rates: For developer hiring inquiries
   - get_mvp_packages: For MVP/startup projects
   - schedule_meeting: To book calls/meetings
   - get_services_list: To show all services

5. For cost questions, use get_cost_estimate tool - don't make up prices
6. Always suggest next steps (demo, meeting, or more info)
7. Keep responses concise but informative
8. Use emojis sparingly for friendliness

## LEAD CAPTURE RULES:
- Ask for name and email when user shows buying intent
- Don't ask for phone immediately (reduces drop-off)
- Phone is needed only for meeting scheduling

## MEETING TYPES:
- Sales Consultant: For project discussions
- Technical Expert: For technical requirements
- CTO Discussion: For strategic/enterprise projects

## PRICING (Use tools for exact figures):
- MVP: ₹1.5L - ₹5L+
- Standard Projects: ₹1L - ₹20L
- Enterprise: ₹20L+
- Hourly: ₹1500/hour
- Monthly: ₹1.8L/developer`;

export async function processChat(botId, message, sessionId, language = "en") {
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│           CHAT SERVICE - PROCESSING MESSAGE            │");
  console.log("└─────────────────────────────────────────────────────────┘");

  if (!isOpenAIConfigured()) {
    console.log("❌ OpenAI not configured!");
    throw new Error("OpenAI not configured");
  }

  const openai = getOpenAI();

  // ============ STEP 1: RAG - Search Documents ============
  console.log("\n📚 STEP 1: RAG - Searching relevant document chunks...");
  const searchStart = Date.now();
  const matches = await searchSimilarChunks(botId, message, 5);
  console.log(`   ⏱️ Search took: ${Date.now() - searchStart}ms`);
  console.log(`   📄 Found ${matches.length} relevant chunks`);
  
  if (matches.length > 0) {
    console.log("   📋 Top matches:");
    matches.slice(0, 3).forEach((m, i) => {
      console.log(`      ${i + 1}. [Score: ${m.similarity.toFixed(3)}] "${m.text.substring(0, 80)}..."`);
    });
  }

  // Build context from documents (if available)
  const documentContext = matches.length > 0 
    ? `\n\n## COMPANY DOCUMENTS:\n${matches.map(m => m.text).join("\n\n")}`
    : "";

  // ============ STEP 2: Load Conversation History ============
  console.log("\n💬 STEP 2: Loading conversation history from DB...");
  const historyStart = Date.now();
  const history = await getConversationHistory(botId, sessionId, 10);
  console.log(`   ⏱️ History loaded in: ${Date.now() - historyStart}ms`);
  console.log(`   📜 Found ${history.length} previous messages`);
  if (history.length > 0) {
    console.log("   Recent history:");
    history.slice(-3).forEach((h) => {
      console.log(`      ${h.role}: "${h.content.substring(0, 50)}..."`);
    });
  }

  // ============ STEP 3: Save User Message to DB ============
  console.log("\n💾 STEP 3: Saving user message to database...");
  const saveStart = Date.now();
  await saveMessage(botId, sessionId, "user", message);
  console.log(`   ⏱️ Saved in: ${Date.now() - saveStart}ms`);
  console.log(`   ✅ User message saved to conversations table`);

  // ============ STEP 4: Build System Prompt ============
  console.log("\n🔧 STEP 4: Building system prompt...");
  const languageInstruction = language === "hi" 
    ? "\n\n## LANGUAGE: Respond in Hindi (हिंदी)" 
    : "\n\n## LANGUAGE: Respond in English";
  
  const systemPrompt = SALES_BOT_PROMPT + documentContext + languageInstruction;
  console.log(`   📝 System prompt length: ${systemPrompt.length} characters`);
  console.log(`   📄 Document context included: ${matches.length > 0 ? "Yes" : "No"}`);

  // ============ STEP 5: Prepare Messages for OpenAI ============
  console.log("\n📤 STEP 5: Preparing messages for OpenAI...");
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];
  console.log(`   📨 Total messages: ${messages.length}`);
  console.log(`   - 1 system prompt`);
  console.log(`   - ${history.length} history messages`);
  console.log(`   - 1 user message`);

  // ============ STEP 6: Define MCP Tools ============
  console.log("\n🔨 STEP 6: Registering MCP tools...");
  const tools = toolDefinitions.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
  console.log(`   🛠️ Available tools: ${tools.map(t => t.function.name).join(", ")}`);

  // ============ STEP 7: Call OpenAI API ============
  console.log("\n🤖 STEP 7: Calling OpenAI API...");
  console.log("   Model: gpt-4o-mini");
  console.log("   Temperature: 0.7");
  console.log("   Max tokens: 1000");
  
  const openaiStart = Date.now();
  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 1000,
  });
  console.log(`   ⏱️ OpenAI response in: ${Date.now() - openaiStart}ms`);
  console.log(`   📊 Usage: ${response.usage?.total_tokens || "N/A"} tokens`);

  let assistantMessage = response.choices[0].message;
  console.log(`   📝 Response type: ${assistantMessage.tool_calls ? "TOOL CALL" : "TEXT"}`);

  // ============ STEP 8: Handle MCP Tool Calls ============
  let iterations = 0;
  while (assistantMessage.tool_calls && iterations < 5) {
    iterations++;
    console.log("\n" + "─".repeat(50));
    console.log(`🔧 MCP TOOL EXECUTION (Iteration ${iterations})`);
    console.log("─".repeat(50));
    
    const toolResults = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      
      console.log(`\n   📞 Tool Call: ${toolCall.function.name}`);
      console.log(`   📋 Arguments:`);
      Object.entries(args).forEach(([key, value]) => {
        console.log(`      - ${key}: ${value}`);
      });

      const toolStart = Date.now();
      // Pass sessionId to tool execution
      const result = await executeTool(botId, sessionId, toolCall.function.name, args);
      console.log(`   ⏱️ Tool executed in: ${Date.now() - toolStart}ms`);
      console.log(`   📤 Result: ${JSON.stringify(result).substring(0, 100)}...`);
      
      toolResults.push({
        tool_call_id: toolCall.id,
        role: "tool",
        content: JSON.stringify(result),
      });
    }

    messages.push(assistantMessage);
    messages.push(...toolResults);

    console.log("\n   🔄 Sending tool results back to OpenAI...");
    const followupStart = Date.now();
    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1000,
    });
    console.log(`   ⏱️ Follow-up response in: ${Date.now() - followupStart}ms`);

    assistantMessage = response.choices[0].message;
    console.log(`   📝 New response type: ${assistantMessage.tool_calls ? "TOOL CALL" : "TEXT"}`);
  }

  const answer = assistantMessage.content || "I couldn't process that request. Please try again.";

  // ============ STEP 9: Save Assistant Response ============
  console.log("\n💾 STEP 9: Saving assistant response to database...");
  const saveRespStart = Date.now();
  await saveMessage(botId, sessionId, "assistant", answer);
  console.log(`   ⏱️ Saved in: ${Date.now() - saveRespStart}ms`);
  console.log(`   ✅ Assistant response saved`);

  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│           CHAT SERVICE - PROCESSING COMPLETE           │");
  console.log("└─────────────────────────────────────────────────────────┘");
  console.log(`   📝 Final answer: "${answer.substring(0, 80)}..."`);

  return {
    answer,
    sessionId,
    sources: matches.length,
  };
}

export default { processChat };
