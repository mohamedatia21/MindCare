import { OpenAI, toFile } from 'openai';

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

    const { audioBase64, language = 'ar' } = body || {};

    if (!audioBase64) {
      res.status(400).json({ error: 'Missing audioBase64 parameter' });
      return;
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const file = await toFile(buffer, 'audio.webm', { type: 'audio/webm' });

    const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '';
    const isGroq = apiKey.startsWith('gsk_') || Boolean(process.env.GROQ_API_KEY);
    const baseURL = isGroq ? 'https://api.groq.com/openai/v1' : undefined;

    const openai = new OpenAI({
      apiKey: apiKey || 'dummy',
      baseURL
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: isGroq ? 'whisper-large-v3-turbo' : 'whisper-1',
      language: language === 'en' ? 'en' : 'ar',
      temperature: 0.2
    });

    const transcript = transcription.text ? transcription.text.trim() : '';

    res.status(200).json({
      ok: true,
      text: transcript
    });
  } catch (error: any) {
    console.error('[MindCare STT Error]:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Transcription failed'
    });
  }
}
