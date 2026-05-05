import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini (New GenAI SDK Pattern)
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // Advanced Auro Gen1 Intelligence (Orchestrated Multi-Model Engine)
  async function callAuroAI(systemPrompt: string, userPrompt: string) {
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    const instructions = `
      You are Auro Gen1, the advanced neural engine for the Auro Study Browser.
      Your goal is to provide elite-level academic assistance, research synthesis, and executive function support.
      
      CORE CAPABILITIES:
      - Deep Reasoning: Break down complex topics into first principles.
      - Structural Analysis: Organize information into clear, logical frameworks.
      - Tool Synthesis: If a problem requires computation or specialized logic, describe the code/method needed.

      ${systemPrompt}
    `.trim();

    // 1. TRY GROQ (Llama 3.3 70B) - Ultra Fast Reasoning
    if (groqKey && groqKey.length > 10) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: instructions },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.6
          })
        });
        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content || "No Groq response.";
        }
      } catch (e) {
        console.error("Groq offline, shifting gears...");
      }
    }

    // 2. TRY DEEPSEEK - Deep Research Logic
    if (deepseekKey && deepseekKey.length > 20) {
      try {
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${deepseekKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: instructions },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.7
          })
        });
        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content || "No DeepSeek response.";
        }
      } catch (error) {
        console.error("DeepSeek failing, trying Gemini next...");
      }
    }

    // 3. TRY GEMINI 2.0 FLASH (SDK Mode)
    try {
      const response = await (genAI as any).models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${instructions}\n\nUSER RESEARCH DATA:\n${userPrompt}`
      });
      return response.text || "Neural connection timeout. Please check research data.";
    } catch (sdkError) {
      console.error("SDK Failed, attempting REST fallback...");
      
      // 4. REST FALLBACK (Raw Fetch)
      if (geminiKey) {
        try {
          const restResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${instructions}\n\n${userPrompt}` }] }]
            })
          });
          if (restResponse.ok) {
            const restData = await restResponse.json();
            return restData.candidates?.[0]?.content?.parts?.[0]?.text || "REST engine returned empty result.";
          }
        } catch (restError) {
          console.error("All neural engines failed.");
        }
      }
    }

    return "Auro Gen1: Tactical engine overload. Please simplify your research query.";
  }

  // AI API Routes
  app.post("/api/summarize", async (req, res) => {
    try {
      const { text, systemPrompt: customPrompt } = req.body;
      const result = await callAuroAI(
        customPrompt || "Act as a high-density summarizer. Extract the 5 most critical insights and 3 action items from this text.",
        text
      );
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: "Summarization failed" });
    }
  });

  app.post("/api/explain", async (req, res) => {
    try {
      const { text, systemPrompt: customPrompt } = req.body;
      const result = await callAuroAI(
        customPrompt || "Explain this concept using the 'Explain Like I'm Five' method first, followed by a rigorous academic definition.",
        text
      );
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: "Explanation failed" });
    }
  });

  app.post("/api/quiz", async (req, res) => {
    try {
      const { text, systemPrompt: customPrompt } = req.body;
      const result = await callAuroAI(
        customPrompt || "Generate a challenging 5-question multiple-choice quiz based on this text. Include an 'Answer Key' at the end with brief justifications.",
        text
      );
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: "Quiz generation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Auro Server running on http://localhost:${PORT}`);
  });
}

startServer();
