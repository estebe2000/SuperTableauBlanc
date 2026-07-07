import fs from 'fs';

async function main() {
  const url = 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/chat/completions';
  const apiKey = '0d1e747a-8dbe-4788-bf9a-c49c23bf1fda';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  if (!fs.existsSync(audioPath)) {
    console.error("Audio file not found:", audioPath);
    return;
  }

  const base64Data = fs.readFileSync(audioPath).toString('base64');
  const models = ['gemma4:12b', 'gemma4-12b', 'gemma-4-12b'];

  for (const model of models) {
    console.log(`Testing model: ${model} on ILaaS...`);
    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'RÉPONDS UNIQUEMENT PAR LA TRANSCRIPTION DE CET AUDIO.'
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
      console.log(`Response Status: ${res.status}`);
      console.log(`Response Text: ${text.slice(0, 300)}`);
    } catch (err) {
      console.error(`Failed for ${model}:`, err.message);
    }
    console.log("--------------------------------------------------");
  }
}

main();
