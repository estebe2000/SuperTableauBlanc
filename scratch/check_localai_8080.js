async function main() {
  const url = 'http://172.16.87.140:8080/v1/models';
  
  console.log("Fetching models from LocalAI :8080...");
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
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
