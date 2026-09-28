import {NextResponse} from "next/server";
import {getAIProvider} from "@/services/ai/stylist";
import {QuizAnswers,StyleProfile} from "@/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const answers: QuizAnswers = {};
    if (body.answers && typeof body.answers === "object") {
      Object.entries(body.answers as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value === "string" && value) answers[key] = value;
      });
    }
    if (!Object.keys(answers).length) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_RESPONSE",
            message: "Answer at least one question to build your profile.",
            provider: "deepseek",
            retryable: false
          }
        },
        {status: 400}
      );
    }

    const result = await getAIProvider().analyzeStyle({
      answers,
      language: body.language === "zh" ? "zh" : "en",
      baseProfile: body.profile && typeof body.profile === "object" ? (body.profile as StyleProfile) : undefined
    });
    return NextResponse.json({...result, fallback: result.mode === "fallback"});
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_ERROR",
          message: "The style profile could not be generated. Please try again.",
          provider: "deepseek",
          retryable: true
        }
      },
      {status: 502}
    );
  }
}
