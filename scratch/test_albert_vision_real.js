import fs from 'fs';

async function main() {
  const url = 'https://albert.api.etalab.gouv.fr/v1/chat/completions';
  const apiKey = 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA';
  const imagePath = '/Users/steeve/.gemini/antigravity-ide/brain/fc7152a3-8e57-4483-bdae-f60d07e18138/albert_connection_success_1780657123347.png';

  if (!fs.existsSync(imagePath)) {
    console.error("Image not found:", imagePath);
    return;
  }

  console.log("Reading real screenshot...");
  const base64Data = fs.readFileSync(imagePath).toString('base64');
  const dataUrl = `data:image/png;base64,${base64Data}`;

  const models = [
    'openai/gpt-oss-120b',
    'mistralai/Ministral-3-8B-Instruct-2512',
    'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
  ];

  for (const model of models) {
    console.log(`Testing model: ${model} with real image...`);
    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Décris précisément ce que tu vois sur cette image. De quoi s\'agit-il ? Quels textes sont écrits ?'
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl
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
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {}

      if (res.ok && data.choices?.[0]?.message?.content) {
        console.log(`🎉 Success with model: ${model}`);
        console.log("Response:", data.choices[0].message.content.slice(0, 800));
      } else {
        const errorMsg = data.error?.message || text;
        console.log(`❌ Failed for ${model}: ${errorMsg.slice(0, 250)}...`);
      }
    } catch (err) {
      console.log(`❌ Request failed for ${model}:`, err.message);
    }
    console.log("--------------------------------------------------");
  }
}

main();
