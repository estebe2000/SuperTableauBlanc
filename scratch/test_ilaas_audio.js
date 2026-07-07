import fs from 'fs';

async function main() {
  const url = 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/chat/completions';
  const apiKey = '0d1e747a-8dbe-4788-bf9a-c49c23bf1fda';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  if (!fs.existsSync(audioPath)) {
    console.error("Audio file not found:", audioPath);
    return;
  }

  console.log("Reading audio file...");
  const base64Data = fs.readFileSync(audioPath).toString('base64');
  console.log("Base64 length:", base64Data.length);

  const payload = {
    model: 'gemma-4-31b',
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
    ],
    temperature: 0.0
  };

  console.log("Sending transcription request for gemma-4-31b to ILaaS...");
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error(`HTTP error: ${res.status}`);
      const text = await res.text();
      console.error("Response:", text);
      return;
    }

    const data = await res.json();
    console.log("Response from ILaaS:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Request failed:", err);
  }
}

main();
