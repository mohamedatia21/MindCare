import 'dotenv/config';
import { OpenAIStreamingLLM } from './src/infrastructure/llm/openai-llm.js';

async function run() {
  console.log('Testing Real LLM Pipeline (Groq / OpenAI)...');
  const llm = new OpenAIStreamingLLM();
  
  const isHealthy = await llm.healthCheck();
  console.log('LLM Configured:', isHealthy);

  if (!isHealthy) {
    console.error('Missing credentials or configuration error.');
    return;
  }

  const request = {
    systemPolicy: 'You are MindCare. Be brief.',
    contextData: '[]',
    userMessage: 'Hello, are you receiving my prompt over the network?'
  };

  const stream = llm.generateStreamingResponse(request);

  console.log('Response stream starting...');
  let chunks = 0;
  for await (const chunk of stream) {
    process.stdout.write(chunk);
    chunks++;
  }
  console.log(`\n\nStream complete. Received ${chunks} chunks.`);
}

run().catch(console.error);
