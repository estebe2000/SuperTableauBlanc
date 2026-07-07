import fs from 'fs';

// Helper to format start time in nanoseconds/seconds to MM:SS
function formatTime(nanoseconds) {
  // LocalAI returns start time in nanoseconds (or sometimes microseconds/seconds depending on backend, let's detect)
  // 6400000000 ns = 6.4s -> divide by 1e9 if large, or check if it's already in seconds
  let seconds = nanoseconds;
  if (nanoseconds > 100000) {
    seconds = nanoseconds / 1e9;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function main() {
  const whisperUrl = 'http://172.16.87.140:8080/v1/audio/transcriptions';
  const llmUrl = 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/chat/completions';
  const apiKey = '0d1e747a-8dbe-4788-bf9a-c49c23bf1fda';
  const audioPath = '/Users/steeve/Documents/toto/audio_10s.wav';

  console.log("Stage 1: Running Whisper transcription...");
  const fileBuffer = fs.readFileSync(audioPath);
  const formData = new FormData();
  formData.append('model', 'whisper-1');
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });
  formData.append('file', blob, 'audio_10s.wav');

  let whisperData;
  try {
    const res = await fetch(whisperUrl, {
      method: 'POST',
      body: formData
    });
    whisperData = await res.json();
  } catch (err) {
    console.error("Whisper failed:", err);
    return;
  }

  if (!whisperData.segments) {
    console.log("No segments returned by Whisper. Full text:", whisperData.text);
    return;
  }

  // Format segments for LLM
  console.log("\nWhisper Segments received:");
  const formattedSegments = whisperData.segments.map(seg => {
    const timeStr = formatTime(seg.start);
    console.log(`[${timeStr}] ${seg.text}`);
    return `[${timeStr}] ${seg.text}`;
  }).join('\n');

  console.log("\nStage 2: Sending to LLM for speaker diarization...");
  const systemPrompt = `Tu es un expert en traitement de transcriptions.
Voici une transcription brute avec horodatages mais sans identification des interlocuteurs :
${formattedSegments}

Consignes :
1. Identifie les différents interlocuteurs en te basant sur le contexte du dialogue (ex: quand quelqu'un dit "bonjour Evelyne", l'autre personne est Evelyne).
2. Attribue chaque réplique à son interlocuteur sous le format : [MM:SS] Nom : Texte.
3. Si le nom n'est pas identifiable, utilise "Interlocuteur A", "Interlocuteur B", etc.
4. Conserve strictement le sens et les horodatages.
5. Réponds uniquement avec la transcription nettoyée et formatée. Pas d'introduction ni de conclusion.`;

  const payload = {
    model: 'gemma-4-31b',
    messages: [
      {
        role: 'user',
        content: systemPrompt
      }
    ],
    temperature: 0.0
  };

  try {
    const res = await fetch(llmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("\nDiarized Output from LLM:");
    console.log(data.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("LLM stage failed:", err);
  }
}

main();
