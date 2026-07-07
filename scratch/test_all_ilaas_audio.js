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
  const models = [
    'gemma-4-31b',
    'gpt-oss-120b',
    'llama-3.1-8b',
    'llama-3.3-70b',
    'mistral-medium-250523',
    'mistral-medium-latest',
    'mistral-small-3.2-24b',
    'mistral-small-4-119b',
    'qwen-3.6-35b-instruct'
  ];

  for (const model of models) {
    console.log(`Testing model: ${model}...`);
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
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {}

      if (res.ok && data.choices?.[0]?.message?.content) {
        console.log(`🎉 Success with model: ${model}`);
        console.log("Transcription:", data.choices[0].message.content);
      } else {
        const errorMsg = data.error?.message || text;
        console.log(`❌ Failed for ${model}: ${errorMsg.slice(0, 200)}...`);
      }
    } catch (err) {
      console.log(`❌ Request failed for ${model}:`, err.message);
    }
    console.log("--------------------------------------------------");
  }
}

main();
