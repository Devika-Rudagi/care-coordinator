import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Plain anon-key client for this one low-stakes counter insert — this
// route has no cookie/session context (it's a stateless API route), and
// the table holds nothing sensitive, just "an extraction happened."
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const extractionSchema = {
  type: "object",
  properties: {
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dosage: { type: "string" },
          frequency: { type: "string" },
          times_of_day: { type: "array", items: { type: "string" } },
        },
        required: ["name", "frequency"],
      },
    },
    appointments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          provider: { type: "string" },
          date: { type: "string" },
        },
        required: ["type"],
      },
    },
    watch_for: {
      type: "array",
      items: {
        type: "object",
        properties: {
          symptom: { type: "string" },
          guidance: { type: "string" },
          urgency: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["symptom", "urgency"],
      },
    },
  },
  required: ["medications", "appointments", "watch_for"],
};

const instructionPrompt = `Extract structured discharge care information from the provided hospital discharge instructions — this may be given as text, an image, or a PDF of the paperwork. Be conservative — only include items explicitly stated, never invent or infer beyond what's written. For ambiguous frequency (e.g. "as needed"), put that phrase directly in the frequency field rather than guessing a schedule. If the source material contains little or no relevant discharge information (e.g. it's blank, unrelated, or unreadable), return empty arrays for all three fields rather than guessing or fabricating content.`;

export async function POST(request: Request) {
  const body = await request.json();
  const { text, imageBase64, mimeType } = body as {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
  };

  if ((!text || !text.trim()) && !imageBase64) {
    return NextResponse.json(
      { error: "No text or file provided." },
      { status: 400 },
    );
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: extractionSchema as any,
    },
  });

  const parts: any[] = [{ text: instructionPrompt }];

  if (text && text.trim()) {
    parts.push({ text: `Discharge instructions text:\n${text}` });
  }

  if (imageBase64 && mimeType) {
    parts.push({
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    });
  }

  let result;
  try {
    result = await model.generateContent(parts);
  } catch (err: any) {
    console.error("Gemini extraction failed:", err.message);
    return NextResponse.json(
      { error: `Extraction failed: ${err.message}` },
      { status: 500 },
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(result.response.text());
  } catch (err: any) {
    console.error("Failed to parse Gemini response as JSON:", err.message);
    console.error("Raw response was:", result.response.text());
    return NextResponse.json(
      { error: "The AI returned something we couldn't understand." },
      { status: 500 },
    );
  }

  // Best-effort usage counter — awaited so it isn't cut off by the
  // function terminating, but its own errors never break the actual
  // extraction response.
  const { error: logError } = await supabase
    .from("extraction_events")
    .insert({});
  if (logError) console.error("Failed to log extraction event:", logError.message);

  return NextResponse.json(parsed);
}
