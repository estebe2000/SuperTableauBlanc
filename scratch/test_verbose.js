import fs from 'fs';

async function main() {
  const url = 'https://albert.api.etalab.gouv.fr/v1/audio/transcriptions';
  const apiKey = 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  console.log("Testing Whisper with response_format=verbose_json...");
  
  const formData = new FormData();
  formData.append('model', 'openai/whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  
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

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Keys returned:", Object.keys(data));
    if (data.segments) {
      console.log(`Segments count: ${data.segments.length}`);
      console.log("First segment:", data.segments[0]);
    } else {
      console.log("Segments is still null/undefined");
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

main();
