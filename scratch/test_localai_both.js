async function testEndpoint(port) {
  const url = `http://172.16.87.140:${port}/v1/models`;
  console.log(`Testing LocalAI on port ${port}...`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      console.log(`[Success :${port}] Models:`, data.data?.map(m => m.id) || data);
    } else {
      console.log(`[HTTP Error :${port}] Status: ${res.status}`);
    }
  } catch (err) {
    console.log(`[Error :${port}] Connection failed:`, err.message);
  }
}

async function main() {
  await testEndpoint(8080);
  await testEndpoint(8081);
}

main();
