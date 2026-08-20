import 'dotenv/config';
import { OpenAIStreamingLLM } from '../src/infrastructure/llm/openai-llm.js';
import { ElevenLabsStreamingTTS } from '../src/infrastructure/voice/elevenlabs-tts.js';
import { LLMRequest } from '../src/clinical/types.js';

async function runLiveBenchmark() {
  console.log("==========================================================");
  console.log(" MINDCARE — LIVE TRACK 2 TELEMETRY & LATENCY BENCHMARK   ");
  console.log(" Date:", new Date().toISOString());
  console.log("==========================================================\n");

  // Check credentials
  console.log("1. Checking Live Provider Credentials:");
  console.log("   - OPENAI_API_KEY (Groq/OpenAI):", process.env.OPENAI_API_KEY ? "CONFIGURED (" + process.env.OPENAI_API_KEY.substring(0, 7) + "...)" : "MISSING");
  console.log("   - DEEPGRAM_API_KEY:", process.env.DEEPGRAM_API_KEY ? "CONFIGURED (" + process.env.DEEPGRAM_API_KEY.substring(0, 7) + "...)" : "MISSING");
  console.log("   - ELEVENLABS_API_KEY:", process.env.ELEVENLABS_API_KEY ? "CONFIGURED (" + process.env.ELEVENLABS_API_KEY.substring(0, 7) + "...)" : "MISSING");

  if (!process.env.OPENAI_API_KEY || !process.env.ELEVENLABS_API_KEY) {
    console.error("\n[ERROR] Required API keys missing. Cannot run live benchmark.");
    process.exit(1);
  }

  // 2. Benchmark LLM Streaming Latency (Time-To-First-Token)
  console.log("\n2. Benchmarking Live LLM Stream (Groq / OpenAI):");
  const llm = new OpenAIStreamingLLM();
  const llmReq: LLMRequest = {
    systemPolicy: "أنت رفيق نفسي داعم بالعامية المصرية. تحدث بجملة واحدة قصيرة وداعمة.",
    contextData: "{}",
    userMessage: "حاسس بإرهاق وتعب ذهني كبير النهاردة."
  };

  const llmStartTime = Date.now();
  let firstTokenTime: number | null = null;
  const tokens: string[] = [];

  const gen = llm.generateStreamingResponse(llmReq);
  let next = await gen.next();
  while (!next.done) {
    if (firstTokenTime === null) {
      firstTokenTime = Date.now() - llmStartTime;
    }
    tokens.push(next.value);
    next = await gen.next();
  }
  const totalLlmTime = Date.now() - llmStartTime;

  console.log(`   - Time-To-First-Token (TTFT): ${firstTokenTime}ms`);
  console.log(`   - Total LLM Duration: ${totalLlmTime}ms`);
  console.log(`   - Total Tokens/Chunks: ${tokens.length}`);
  console.log(`   - Full LLM Response: "${next.value.response}"`);

  // 3. Benchmark TTS Streaming Latency (Time-To-First-Audio)
  console.log("\n3. Benchmarking Live ElevenLabs TTS Stream:");
  const tts = new ElevenLabsStreamingTTS();
  const testPhrase = next.value.response || "أنا سامعك ومعاك، خطوة بخطوة كل حاجة هتعدي.";
  
  async function* textStream() {
    for (const word of testPhrase.split(' ')) {
      yield word + ' ';
    }
  }

  const ttsStartTime = Date.now();
  let firstAudioTime: number | null = null;
  let totalAudioBytes = 0;
  let audioChunksCount = 0;

  for await (const chunk of tts.synthesizeStream(textStream(), 'bench-turn-' + Date.now())) {
    if (chunk.audioChunk) {
      if (firstAudioTime === null) {
        firstAudioTime = Date.now() - ttsStartTime;
      }
      totalAudioBytes += chunk.audioChunk.length;
      audioChunksCount++;
    }
  }
  const totalTtsTime = Date.now() - ttsStartTime;

  console.log(`   - Time-To-First-Audio (TTFA): ${firstAudioTime}ms`);
  console.log(`   - Total TTS Duration: ${totalTtsTime}ms`);
  console.log(`   - Audio Chunks Received: ${audioChunksCount}`);
  console.log(`   - Total PCM Bytes: ${totalAudioBytes} bytes (~${(totalAudioBytes / (24000 * 2)).toFixed(2)} seconds of 24kHz audio)`);

  // 4. End-to-End Latency Evaluation
  const pipelineTTFA = (firstTokenTime || 0) + (firstAudioTime || 0);
  console.log("\n4. End-to-End Pipeline Performance Summary:");
  console.log(`   - Estimated Turn TTFA (LLM TTFT + TTS TTFA): ${pipelineTTFA}ms`);
  console.log(`   - Sub-800ms Realtime Target: ${pipelineTTFA <= 800 ? '✅ PASSED' : '⚠️ ' + pipelineTTFA + 'ms (Network dependent)'}`);

  console.log("\n==========================================================");
  console.log(" BENCHMARK COMPLETED SUCCESSFULLY                         ");
  console.log("==========================================================");
}

runLiveBenchmark().catch(err => {
  console.error("\n[CRITICAL BENCHMARK FAILURE]:", err);
  process.exit(1);
});
