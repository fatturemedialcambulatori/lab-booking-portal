import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { examsTable } from "@workspace/db";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

router.post("/ocr/prescription", async (req, res) => {
  const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "imageBase64 e mimeType sono obbligatori" });
  }

  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedMimes.includes(mimeType)) {
    return res.status(400).json({ error: "Formato immagine non supportato. Usa JPEG, PNG o WebP." });
  }

  try {
    const exams = await db.select({
      id: examsTable.id,
      codiceAnalisi: examsTable.codiceAnalisi,
      descrizione: examsTable.descrizione,
    }).from(examsTable).orderBy(examsTable.descrizione);

    const examListText = exams
      .map((e) => `ID:${e.id} | Codice:${e.codiceAnalisi} | Nome:${e.descrizione}`)
      .join("\n");

    const systemPrompt = `Sei un assistente medico che analizza ricette mediche italiane.
Hai a disposizione il seguente listino di esami di laboratorio:

${examListText}

Il tuo compito:
1. Analizza l'immagine della ricetta medica
2. Estrai tutti gli esami/analisi richiesti
3. Abbina ogni esame estratto agli ID del listino (corrispondenza per nome o codice, anche parziale o con sinonimi comuni)
4. Restituisci SOLO un JSON con questa struttura esatta:
{
  "matchedExamIds": [array di ID numerici degli esami abbinati],
  "extractedTerms": [array di stringhe con i termini esatti estratti dalla ricetta]
}

Note importanti:
- Usa corrispondenze flessibili (es. "emocromo" = "EMOCROMO COMPLETO", "colesterolo" = "COLESTEROLO TOTALE")
- Se un esame non è nel listino, includilo in extractedTerms ma non in matchedExamIds
- Non inventare abbinamenti incerti: includi solo corrispondenze ragionevoli
- Rispondi SOLO con il JSON, senza testo aggiuntivo`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: systemPrompt,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";

    let parsed: { matchedExamIds: number[]; extractedTerms: string[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      req.log.warn({ content }, "OCR response JSON parse failed");
      return res.json({ matchedExamIds: [], extractedTerms: [] });
    }

    const validIds = new Set(exams.map((e) => e.id));
    const matchedExamIds = (parsed.matchedExamIds ?? []).filter(
      (id) => typeof id === "number" && validIds.has(id)
    );

    return res.json({
      matchedExamIds,
      extractedTerms: parsed.extractedTerms ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "OCR prescription failed");
    return res.status(500).json({ error: "Errore durante l'analisi della ricetta. Riprova." });
  }
});

export default router;
