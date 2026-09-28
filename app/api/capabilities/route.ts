import {NextResponse} from "next/server";
import {providerCapabilities} from "@/services/ai/stylist";

export async function GET() {
  return NextResponse.json(providerCapabilities());
}
