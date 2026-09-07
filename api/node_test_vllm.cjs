// Replicates api/services/ai/openai.ts exactly, timed, against live vLLM.
const fs = require("fs");
const env = JSON.parse(fs.readFileSync("C:\\Users\\KEOVOIN-DESKTOP\\env.json", "utf8"));
const KV = Object.fromEntries(env.map((e) => [e.envVar.key, e.envVar.value]));

const OpenAI = require("openai");
const client = new OpenAI({ baseURL: KV.OPENAI_BASE_URL, apiKey: KV.OPENAI_API_KEY });

const prompt = [
  "You are a chess engine. Reply with ONLY valid JSON.",
  "Position (FEN): r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
  'Respond with {"thought":"...","move":{"from":"e1","to":"e2"}}',
].join("\n");

const SCHEMA = {
  name: "ChessMoveResponse",
  schema: {
    type: "object",
    properties: {
      thought: { type: "string", description: "Reasoning" },
      move: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" } },
        required: ["from", "to"],
      },
    },
    required: ["thought", "move"],
  },
};

async function run(label, extra) {
  const t0 = Date.now();
  try {
    const c = await client.chat.completions.create({
      model: "Qwen3.8-27B",
      messages: [{ role: "user", content: prompt }],
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: SCHEMA },
      ...(extra || {}),
    });
    const dt = ((Date.now() - t0) / 1000).toFixed(2);
    const out = c.usage ? c.usage.completion_tokens : "?";
    const content = (c.choices[0]?.message?.content || "").slice(0, 90).replace(/\n/g, " ");
    console.log(`${label}\t${dt}s\tout_tok=${out}\t${content}`);
  } catch (e) {
    console.log(`${label}\tERR ${(Date.now() - t0) / 1000}s\t${String(e.message).slice(0, 120)}`);
  }
}

(async () => {
  await run("A no chat_template_kwargs (reasoning_effort low only)", {});
  await run("B with chat_template_kwargs enable_thinking:false", { chat_template_kwargs: { enable_thinking: false } });
})();
