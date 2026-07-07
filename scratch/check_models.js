async function main() {
  const url = 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/models';
  const apiKey = '0d1e747a-8dbe-4788-bf9a-c49c23bf1fda';
  
  console.log("Fetching models from ILaaS...");
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
        console.log(`- ID: ${m.id}, Owned by: ${m.owned_by}`);
      });
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Request failed:", err);
  }
}

main();
