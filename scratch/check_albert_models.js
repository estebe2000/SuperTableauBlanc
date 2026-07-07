async function main() {
  const url = 'https://albert.api.etalab.gouv.fr/v1/models';
  const apiKey = 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA';
  
  console.log("Fetching models from Albert...");
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      console.error(`HTTP error: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error("Response:", text);
      return;
    }
    
    const data = await res.json();
    console.log("Success! Models returned:");
    if (data && Array.isArray(data.data)) {
      data.data.forEach(m => {
        console.log(`- ID: ${m.id}`);
      });
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Request failed:", err);
  }
}

main();
