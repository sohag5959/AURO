export async function summarizeText(text: string) {
  try {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    return data.result || "No summary available.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Failed to summarize. Please check your connection.";
  }
}

export async function explainConcept(text: string) {
  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    return data.result || "No explanation available.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Failed to explain concept.";
  }
}

export async function generateQuiz(text: string) {
  try {
    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    return data.result || "No quiz available.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Failed to generate quiz.";
  }
}
