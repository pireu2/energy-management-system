const HF_TOKEN =
  process.env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_TOKEN || "";

console.log("=== AI Service Loaded ===");
console.log("HF_TOKEN present:", !!HF_TOKEN);
console.log("HF_TOKEN length:", HF_TOKEN?.length || 0);
console.log("HF_TOKEN first 10 chars:", HF_TOKEN?.substring(0, 10) || "N/A");

const SYSTEM_PROMPT = `You are a helpful customer support assistant for an Energy Management System. 
Your role is to help users with:
- Device management (adding, removing, configuring devices)
- Energy consumption monitoring
- Account and profile settings
- Technical troubleshooting
- General inquiries about the system

Keep responses concise, friendly, and helpful. If you don't know the answer, suggest contacting a human administrator.
Do not make up features that don't exist. The system includes: device management, energy monitoring, user management, and real-time alerts.`;

const MODELS = [
  "mistralai/Mistral-7B-Instruct-v0.3",
  "meta-llama/Llama-3.2-3B-Instruct",
  "Qwen/Qwen2.5-72B-Instruct",
];

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

async function callChatCompletion(
  model: string,
  userMessage: string
): Promise<string> {
  const url = "https://router.huggingface.co/v1/chat/completions";
  console.log(`[HF API] Calling: ${url} with model: ${model}`);

  const payload = {
    model: model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 200,
    temperature: 0.7,
  };

  console.log(`[HF API] Payload:`, JSON.stringify(payload).substring(0, 300));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  console.log(`[HF API] Response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[HF API] Error response: ${errorText}`);
    throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
  }

  const jsonResponse = (await response.json()) as ChatCompletionResponse;
  console.log(
    `[HF API] Response:`,
    JSON.stringify(jsonResponse).substring(0, 500)
  );

  const content = jsonResponse.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response");
  }

  return content.trim();
}

export async function getAIResponse(userMessage: string): Promise<string> {
  console.log(`\n=== getAIResponse called ===`);
  console.log(`User message: "${userMessage}"`);
  console.log(`HF_TOKEN present: ${!!HF_TOKEN}`);

  if (!HF_TOKEN) {
    console.error("No Hugging Face token configured");
    return "AI support is currently unavailable. Please contact a human administrator for assistance.";
  }

  for (const model of MODELS) {
    try {
      console.log(`\n--- Trying model: ${model} ---`);
      const response = await callChatCompletion(model, userMessage);

      if (response && response.length >= 10) {
        console.log(`SUCCESS with model: ${model}`);
        console.log(`Response: ${response.substring(0, 200)}`);
        return response;
      } else {
        console.log(`[Model ${model}] Response too short, trying next model`);
      }
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
    }
  }

  return "I'm having trouble processing your request right now. Please try again later or contact a human administrator for immediate assistance.";
}

export function isAIEnabled(): boolean {
  return !!HF_TOKEN;
}
