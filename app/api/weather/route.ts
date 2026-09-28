import {NextResponse} from "next/server";
import {getWeather} from "@/services/weather/weatherProvider";
import {Language} from "@/types";

/** `GET /api/weather?city=Shanghai&lang=zh` — 默认中文；实时失败时回落到快照并标注来源。 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city")?.trim() || undefined;
  const raw = params.get("lang");
  const language: Language = raw === "en" ? "en" : "zh";
  if(city && city.length>100) return NextResponse.json({error:"City name is too long"},{status:400});
  return NextResponse.json(await getWeather(city, language,{refresh:params.get("refresh")==="1"}),{headers:{"Cache-Control":"no-store"}});
}
