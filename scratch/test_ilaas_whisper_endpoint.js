import fs from 'fs';

async function main() {
  const url = 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/audio/transcriptions';
  const apiKey = '0d1e747a-8dbe-4788-bf9a-c49c23bf1fda';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  if (!fs.existsSync(audioPath)) {
    console.error("Audio file not found:", audioPath);
    return;
  }

  const fileBuffer = fs.readFileSync(audioPath);
  const modelsToTest = [
    'gemma-4-31b',
    'gpt-oss-120b',
    'whisper-1',
    'openai/whisper-large-v3',
    'whisper'
  ];

  for (const model of modelsToTest) {
    console.log(`Testing transcription endpoint on ILaaS with model: ${model}...`);
    const formData = new FormData();
    formData.append('model', model);
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
      console.log(`Response Status: ${res.status}`);
      console.log(`Response Text: ${text.slice(0, 300)}`);
    } catch (err) {
      console.error(`Request failed for ${model}:`, err.message);
    }
    console.log("--------------------------------------------------");
  }
}

main();
