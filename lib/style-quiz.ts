import {QuizAnswers, QuizQuestion, StyleProfile} from "@/types";

export const styleQuiz: QuizQuestion[] = [
  {
    id: "vibe",
    prompt: { en: "What should people notice first?", zh: "你希望别人第一眼注意到什么？" },
    hint: { en: "There is no wrong answer — this sets the tone.", zh: "没有标准答案，这一步只用来定基调。" },
    options: [
      {
        id: "calm",
        label: { en: "Quiet, considered restraint", zh: "安静、克制的分寸感" },
        note: { en: "Few logos, honest fabrics", zh: "少标识，面料说话" },
        styles: ["极简", "静奢"],
        brands: ["COS", "AURALEE", "Lemaire"]
      },
      {
        id: "easy",
        label: { en: "An easy, everyday softness", zh: "松弛的日常感" },
        note: { en: "Relaxed but put together", zh: "放松但依然得体" },
        styles: ["韩系休闲", "极简"],
        brands: ["Ader Error", "Low Classic"]
      },
      {
        id: "sharp",
        label: { en: "A strong, tailored line", zh: "有力量的剪裁轮廓" },
        note: { en: "Shoulders and hems do the talking", zh: "肩线与裤脚线决定气场" },
        styles: ["现代剪裁", "静奢"],
        brands: ["Studio Nicholson", "COS"]
      },
      {
        id: "layered",
        label: { en: "Layers with an edge", zh: "有层次的街头感" },
        note: { en: "Volume, texture, contrast", zh: "体积、质感、对比" },
        styles: ["街头", "层次叠穿"],
        brands: ["Carhartt WIP", "Stüssy"]
      }
    ]
  },
  {
    id: "palette",
    prompt: { en: "Which palette feels like home?", zh: "哪一组颜色最像你的日常？" },
    options: [
      {
        id: "neutral",
        label: { en: "Black, grey, navy", zh: "黑、灰、海军蓝" },
        colors: ["黑色", "灰色", "海军蓝"]
      },
      {
        id: "earth",
        label: { en: "Oat, beige, brown", zh: "燕麦、米、棕" },
        colors: ["燕麦", "米色", "棕色"]
      },
      {
        id: "tonal",
        label: { en: "Charcoal and graphite tones", zh: "炭灰与石墨的同色层次" },
        colors: ["炭灰", "石墨灰", "银色"]
      },
      {
        id: "contrast",
        label: { en: "High contrast with one accent", zh: "黑白对比，加一个亮点色" },
        colors: ["黑色", "白色", "橄榄绿"]
      }
    ]
  },
  {
    id: "silhouette",
    prompt: { en: "How should clothes sit on you?", zh: "你希望衣服怎样落在身上？" },
    options: [
      {
        id: "relaxed",
        label: { en: "Relaxed and easy", zh: "松弛、留有余量" },
        silhouettes: ["Relaxed", "Oversized"],
        fitPreference: "Relaxed"
      },
      {
        id: "straight",
        label: { en: "Straight and clean", zh: "直筒、干净利落" },
        silhouettes: ["Straight", "Tailored"],
        fitPreference: "Regular"
      },
      {
        id: "cropped",
        label: { en: "Short top, wide bottom", zh: "上短下宽，比例分明" },
        silhouettes: ["Cropped", "Wide"],
        fitPreference: "Cropped"
      },
      {
        id: "draped",
        label: { en: "Soft and draped", zh: "柔软、自然垂坠" },
        silhouettes: ["Draped", "Flowing"],
        fitPreference: "Relaxed"
      }
    ]
  },
  {
    id: "occasion",
    prompt: { en: "Where do you dress for most weeks?", zh: "一周里你更需要为哪种场合穿衣？" },
    options: [
      {
        id: "work",
        label: { en: "Studio and office days", zh: "工作室与办公室" },
        styles: ["商务休闲", "现代剪裁"],
        silhouettes: ["Tailored", "Straight"]
      },
      {
        id: "city",
        label: { en: "City weekends and errands", zh: "城市周末与日常出行" },
        styles: ["城市休闲", "极简"],
        silhouettes: ["Relaxed"]
      },
      {
        id: "evening",
        label: { en: "Dinners and evenings out", zh: "晚餐与夜间聚会" },
        styles: ["夜间", "静奢"],
        silhouettes: ["Tailored"]
      },
      {
        id: "travel",
        label: { en: "Travel and long days", zh: "差旅与长时间在外" },
        styles: ["层次叠穿", "城市休闲"],
        silhouettes: ["Layered", "Relaxed"]
      }
    ]
  },
  {
    id: "budget",
    prompt: { en: "What is your monthly wardrobe budget?", zh: "你每个月的添置预算是多少？" },
    options: [
      { id: "b1", label: { en: "Under ¥800", zh: "800 元以内" }, budget: 800 },
      { id: "b2", label: { en: "¥800 – ¥1,500", zh: "800 – 1,500 元" }, budget: 1500 },
      { id: "b3", label: { en: "¥1,500 – ¥3,000", zh: "1,500 – 3,000 元" }, budget: 3000 },
      { id: "b4", label: { en: "¥3,000 and above", zh: "3,000 元以上" }, budget: 5000 }
    ]
  }
];

const baseProfile: StyleProfile = {
  preferredStyles: [],
  colors: [],
  silhouettes: [],
  brands: [],
  height: 178,
  weight: 68,
  budget: 1500
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

/** Deterministic, offline-safe profile derivation used when no AI key is configured. */
export function deriveProfileFromAnswers(
  answers: QuizAnswers,
  base: StyleProfile = baseProfile
): StyleProfile {
  const selected = styleQuiz
    .map(question => question.options.find(option => option.id === answers[question.id]))
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  if (!selected.length) return {...base};

  const styles = unique(selected.flatMap(option => option.styles ?? []));
  const colors = unique(selected.flatMap(option => option.colors ?? []));
  const silhouettes = unique(selected.flatMap(option => option.silhouettes ?? []));
  const brands = unique(selected.flatMap(option => option.brands ?? []));
  const budget = selected.reduce<number | undefined>(
    (found, option) => found ?? option.budget,
    undefined
  );
  const fitPreference = selected.reduce<string | undefined>(
    (found, option) => found ?? option.fitPreference,
    undefined
  );
  const bodyType = selected.reduce<string | undefined>(
    (found, option) => found ?? option.bodyType,
    undefined
  );

  return {
    ...base,
    preferredStyles: styles.length ? styles.slice(0, 4) : base.preferredStyles,
    colors: colors.length ? colors.slice(0, 5) : base.colors,
    silhouettes: silhouettes.length ? silhouettes.slice(0, 4) : base.silhouettes,
    brands: brands.length ? brands.slice(0, 4) : base.brands,
    budget: budget ?? base.budget,
    fitPreference: fitPreference ?? base.fitPreference,
    bodyType: bodyType ?? base.bodyType,
    updatedAt: new Date().toISOString()
  };
}

export function quizProgress(answers: QuizAnswers) {
  const answered = styleQuiz.filter(question => answers[question.id]).length;
  return {answered, total: styleQuiz.length};
}
