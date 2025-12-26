import { getOpenAI, isOpenAIConfigured } from "../config/openai.js";
import { searchSimilarChunks } from "./document.service.js";
import { saveMessage, getConversationHistory } from "./database.service.js";
import { toolDefinitions, executeTool } from "./appointment.service.js";

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

  if (matches.length === 0) {
    console.log("   ⚠️ No documents found - asking user to upload");
    return {
      answer: language === "hi" 
        ? "कृपया पहले एक दस्तावेज़ अपलोड करें।" 
        : "Please upload a document first.",
      sessionId,
      sources: 0,
    };
  }

  const context = matches.map(m => m.text).join("\n\n");
  console.log(`   📝 Context length: ${context.length} characters`);

  // ============ STEP 2: Load Conversation History ============
  console.log("\n💬 STEP 2: Loading conversation history from DB...");
  const historyStart = Date.now();
  const history = await getConversationHistory(botId, sessionId, 8);
  console.log(`   ⏱️ History loaded in: ${Date.now() - historyStart}ms`);
  console.log(`   📜 Found ${history.length} previous messages`);
  if (history.length > 0) {
    console.log("   Recent history:");
    history.slice(-3).forEach((h, i) => {
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
  const systemPrompt = `You are a helpful AI assistant for a company. You can:
1. Answer questions based on company documents
2. Help book meetings with the team

LANGUAGE: ${language === "hi" ? "Respond in Hindi (हिंदी)" : "Respond in English"}

COMPANY INFO:
---
${context}
---

BOOKING RULES:
- Collect: client name, phone, preferred date, time
- Purpose defaults to "Discussion" if not provided
- Use book_appointment tool when you have all details

Be professional, helpful, and concise.`;

  console.log(`   📝 System prompt length: ${systemPrompt.length} characters`);

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
  console.log("   Max tokens: 800");
  
  const openaiStart = Date.now();
  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 800,
  });
  console.log(`   ⏱️ OpenAI response in: ${Date.now() - openaiStart}ms`);
  console.log(`   📊 Usage: ${response.usage?.total_tokens || "N/A"} tokens`);

  let assistantMessage = response.choices[0].message;
  console.log(`   📝 Response type: ${assistantMessage.tool_calls ? "TOOL CALL" : "TEXT"}`);

  // ============ STEP 8: Handle MCP Tool Calls ============
  let iterations = 0;
  while (assistantMessage.tool_calls && iterations < 3) {
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
      const result = await executeTool(botId, toolCall.function.name, args);
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
      max_tokens: 800,
    });
    console.log(`   ⏱️ Follow-up response in: ${Date.now() - followupStart}ms`);

    assistantMessage = response.choices[0].message;
    console.log(`   📝 New response type: ${assistantMessage.tool_calls ? "TOOL CALL" : "TEXT"}`);
  }

  const answer = assistantMessage.content || "I couldn't process that request.";

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
