import fs from 'fs';

async function testChatCompletions() {
  const url = 'https://albert.api.etalab.gouv.fr/v1/chat/completions';
  const apiKey = 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  console.log("Testing Whisper via chat completions...");
  const base64Data = fs.readFileSync(audioPath).toString('base64');
  
  const payload = {
    model: 'openai/whisper-large-v3',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Transcrire cet audio.'
          },
          {
            type: 'input_audio',
            input_audio: {
              data: base64Data,
              format: 'wav'
            }
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("Chat completions response status:", res.status);
    console.log("Response text:", text.slice(0, 500));
  } catch (err) {
    console.error("Chat completions failed:", err);
  }
}

async function testAudioTranscriptions() {
  const url = 'https://albert.api.etalab.gouv.fr/v1/audio/transcriptions';
  const apiKey = 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  console.log("\nTesting Whisper via /v1/audio/transcriptions...");
  
  const formData = new FormData();
  formData.append('model', 'openai/whisper-large-v3');
  
  const fileBuffer = fs.readFileSync(audioPath);
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });
  formData.append('file', blob, 'audio_10s.wav');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    const text = await res.text();
    console.log("Audio transcriptions status:", res.status);
    console.log("Response text:", text.slice(0, 500));
  } catch (err) {
    console.error("Audio transcriptions failed:", err);
  }
}

async function run() {
  await testChatCompletions();
  await testAudioTranscriptions();
}

run();
