import 'dotenv/config';
import { ElevenLabsStreamingTTS } from './src/infrastructure/voice/elevenlabs-tts.js';

async function run() {
  console.log('Testing Real TTS Pipeline (ElevenLabs)...');
  const tts = new ElevenLabsStreamingTTS();

  const textStream = (async function* () {
    yield 'أهلاً بك، ';
    await new Promise(r => setTimeout(r, 100));
    yield 'أنا موجود هنا لمساعدتك.';
  })();

  const stream = tts.synthesizeStream(textStream, 'test-turn');

  console.log('TTS stream starting...');
  try {
    let receivedAudio = false;
    for await (const chunk of stream) {
      if (chunk.audioChunk && chunk.audioChunk.length > 0) {
        if (!receivedAudio) {
           console.log('Received first audio chunk! Stream is working.');
           receivedAudio = true;
        }
      }
    }
    
    if (receivedAudio) {
        console.log('Stream completed successfully. Credentials are valid.');
    } else {
        console.error('Stream completed but NO AUDIO chunks were received.');
    }
  } catch (err) {
    console.error('TTS stream failed:', err);
  }
}

run().catch(console.error);
