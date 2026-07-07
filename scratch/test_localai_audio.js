import fs from 'fs';

async function testWhisper() {
  const url = 'http://172.16.87.140:8080/v1/audio/transcriptions';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  console.log("Testing Whisper-1 on LocalAI 8080 via /v1/audio/transcriptions...");
  const fileBuffer = fs.readFileSync(audioPath);
  const formData = new FormData();
  formData.append('model', 'whisper-1');
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });
  formData.append('file', blob, 'audio_10s.wav');

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const text = await res.text();
    console.log(`Whisper Status: ${res.status}`);
    console.log(`Whisper Response: ${text}`);
  } catch (err) {
    console.error("Whisper test failed:", err);
  }
}

async function testGemma4() {
  const url = 'http://172.16.87.140:8080/v1/chat/completions';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  console.log("\nTesting gemma4-12b on LocalAI 8080 via /v1/chat/completions...");
  const base64Data = fs.readFileSync(audioPath).toString('base64');
  const payload = {
    model: 'gemma4-12b',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'RÉPONDS UNIQUEMENT PAR LA TRANSCRIPTION DE CET AUDIO EN FRANÇAIS.'
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log(`Gemma4 Status: ${res.status}`);
    console.log(`Gemma4 Response: ${text.slice(0, 500)}`);
  } catch (err) {
    console.error("Gemma4 test failed:", err);
  }
}

async function main() {
  await testWhisper();
  await testGemma4();
}

main();
