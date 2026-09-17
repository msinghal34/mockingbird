import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { MODEL } from "./model";

export { MODEL, PROMPT_VERSION } from "./model";

export class LlmError extends Error {}

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new LlmError("GEMINI_API_KEY is not set.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * One zod schema drives both the model's output contract and the runtime
 * check, so a response that parses is a response we can trust.
 */
export async function generateJson<T extends z.ZodType>({
  schema,
  system,
  prompt,
  temperature,
}: {
  schema: T;
  system: string;
  prompt: string;
  temperature: number;
}): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-7",
    io: "output",
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;

  let raw: string | undefined;
  try {
    const response = await ai().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    });
    raw = response.text;
  } catch (cause) {
    throw new LlmError(
      `Gemini request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!raw) {
    throw new LlmError("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new LlmError("Gemini returned something that was not JSON.");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new LlmError(
      `Gemini returned JSON in an unexpected shape: ${result.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}

/**
 * responseMimeType should make this unnecessary, but a model that ignores it
 * once shouldn't take a generation down with it.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
}
