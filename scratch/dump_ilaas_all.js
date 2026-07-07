async function main() {
  const url = 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/models';
  const apiKey = '0d1e747a-8dbe-4788-bf9a-c49c23bf1fda';
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
main();
