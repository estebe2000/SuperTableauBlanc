async function main() {
  const url = 'https://albert.api.etalab.gouv.fr/v1/chat/completions';
  const apiKey = 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA';
  
  // 1x1 pixel base64 image
  const dummyImage = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const dataUrl = `data:image/gif;base64,${dummyImage}`;

  const models = [
    'openai/gpt-oss-120b',
    'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    'mistralai/Ministral-3-8B-Instruct-2512',
    'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
  ];

  for (const model of models) {
    console.log(`Testing model: ${model} with image input...`);
    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Que vois-tu sur cette image ?'
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
        console.log("Response:", data.choices[0].message.content);
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
