/**
 * 宽松 JSON 解析：模型偶尔会返回被截断、带代码块或含裸换行的 JSON。
 * 直接 `JSON.parse` 抛错会导致整次调用降级，所以这里做多级修复：
 * 原样解析 → 截取最外层对象 → 修复（补引号/补括号/转义裸换行/去尾逗号）。
 */
const stripFence = (text: string) =>
  text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

const tryParse = (text: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** 从第一个 `{` 开始逐字符扫描，补齐未闭合的字符串与括号，并修掉裸换行。 */
function repair(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let out = "";

  for (const ch of text.slice(start)) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        out += "\\n";
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      out += ch;
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      out += ch;
      continue;
    }
    out += ch;
  }

  if (inString) out += '"';
  out = out.replace(/[,:]\s*$/, "");
  while (stack.length) {
    const open = stack.pop();
    out += open === "{" ? "}" : "]";
  }
  out = out.replace(/,\s*([}\]])/g, "$1");
  return tryParse(out);
}

export function parseJsonLoose(input: string): Record<string, unknown> | null {
  const cleaned = stripFence(input);
  const direct = tryParse(cleaned);
  if (direct) return direct;

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = tryParse(cleaned.slice(start, end + 1));
    if (sliced) return sliced;
  }

  return repair(cleaned);
}
