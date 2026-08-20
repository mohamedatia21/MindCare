import { OpenAI } from 'openai';

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { text, language = 'ar' } = body || {};
    const cleanText = (text || '').replace(/[*_#`~[\]()]/g, '').slice(0, 400).trim();

    if (!cleanText) {
      res.status(400).json({ error: 'Missing text parameter' });
      return;
    }

    // 1. If ElevenLabs API Key is configured
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam / Default Voice

    if (elevenLabsKey) {
      try {
        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsKey
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (elevenRes.ok) {
          const arrayBuffer = await elevenRes.arrayBuffer();
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          res.status(200).json({
            ok: true,
            audioBase64: base64Audio,
            contentType: 'audio/mpeg'
          });
          return;
        }
      } catch (elevenErr) {
        console.warn('[MindCare TTS] ElevenLabs TTS error:', elevenErr);
      }
    }

    // 2. OpenAI TTS if OpenAI key is available
    const openaiKey = process.env.OPENAI_API_KEY || '';
    if (openaiKey && openaiKey.startsWith('sk-')) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const mp3 = await openai.audio.speech.create({
          model: 'tts-1',
          voice: 'alloy',
          input: cleanText
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        const base64Audio = buffer.toString('base64');
        res.status(200).json({
          ok: true,
          audioBase64: base64Audio,
          contentType: 'audio/mpeg'
        });
        return;
      } catch (openAiTtsErr) {
        console.warn('[MindCare TTS] OpenAI TTS error:', openAiTtsErr);
      }
    }

    // 3. Fallback: Return flag indicating client-side Web Speech Synthesis fallback
    res.status(200).json({
      ok: false,
      fallbackToBrowserSynth: true
    });
  } catch (error: any) {
    console.error('[MindCare TTS Handler Error]:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'TTS generation failed'
    });
  }
}
