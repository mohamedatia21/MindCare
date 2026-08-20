import 'dotenv/config';
import { DeepgramStreamingSTT } from './src/infrastructure/voice/deepgram-stt.js';
import { RuntimeLogger } from './src/observability/runtime-logger.js';

async function run() {
  console.log('Testing Real STT Pipeline (Deepgram)...');
  const stt = new DeepgramStreamingSTT();

  // Create a mock stream of audio data (just sending some empty buffers to see if the connection is accepted and closed without auth error)
  const audioStream = (async function* () {
    yield Buffer.alloc(1024);
    await new Promise(r => setTimeout(r, 100));
    yield Buffer.alloc(1024);
  })();

  const stream = stt.transcribeStream(audioStream);

  console.log('STT stream starting...');
  try {
    for await (const chunk of stream) {
      console.log('Received chunk:', chunk);
    }
    console.log('Stream completed successfully. Credentials are valid.');
  } catch (err) {
    console.error('STT stream failed:', err);
  }
}

run().catch(console.error);
