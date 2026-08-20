import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function cloneVoice() {
  const filePath = path.resolve('voice_preview_ahmad - conversational ai voice.mp3');
  console.log('Cloning voice from:', filePath);
  
  const blob = new Blob([fs.readFileSync(filePath)], { type: 'audio/mpeg' });
  
  const formData = new FormData();
  formData.append('name', 'Ahmad (MindCare)');
  formData.append('files', blob, 'voice_preview_ahmad - conversational ai voice.mp3');
  formData.append('description', 'Egyptian Arabic empathetic AI for MindCare');

  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!
    },
    body: formData as any
  });

  const result = await response.json();
  if (response.ok) {
    console.log('Voice Cloned Successfully!');
    console.log('VOICE_ID:', result.voice_id);
  } else {
    console.error('Failed to clone voice:', result);
  }
}

cloneVoice().catch(console.error);
