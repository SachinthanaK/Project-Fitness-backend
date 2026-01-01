const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const DEFAULT_URL = "https://generativelanguage.googleapis.com/v1beta";

function buildPrompt(item) {
  return `Act as a nutrition database. Provide the average calories for "${item}" per 100g.
  Return ONLY a valid JSON object. 
  Format: {"calories_per_100g": number}`;
}

async function getCaloriesPer100g(item) {
  if (!item) throw new Error("Food item is required");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  // Constructing the full URL correctly
  const url = `${DEFAULT_URL}/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(item) }] }],
        generationConfig: {
          temperature: 0.1, // Low temperature for factual consistency
          maxOutputTokens: 100,
          responseMimeType: "application/json", // Forces JSON mode if supported
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Gemini API Error: ${errorData.error?.message || response.statusText}`
      );
    }

    const payload = await response.json();
    const rawText =
      payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!rawText) throw new Error("Empty response from AI");

    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    const calories = Number(parsed.calories_per_100g);

    if (isNaN(calories)) {
      throw new Error("Invalid calorie value returned");
    }

    return calories;
  } catch (err) {
    console.error("Internal API Error:", err.message);
    throw err;
  }
}

module.exports = { getCaloriesPer100g };
