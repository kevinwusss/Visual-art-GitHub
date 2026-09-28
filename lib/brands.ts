/**
 * 秀场／时装品牌清单（用户指定）。
 * - `name`：对外显示名
 * - `domain`：品牌官网域名（用于把官网图片识别为"品牌官方"等级）
 * - `search`：检索用关键词（部分品牌中文检索更容易出图）
 * - `channel`：跳转链接用的关键词（中文电商站点用中文名更准）
 */
export type Brand = {
  id: string;
  name: string;
  domain?: string;
  search: string;
  channel?: string;
  group: "designer" | "street" | "oldmoney" | "outdoor";
};

export const BRANDS: Brand[] = [
  // 设计师／时装屋
  {id: "balenciaga", name: "Balenciaga", domain: "balenciaga.com", search: "balenciaga runway", group: "designer"},
  {id: "lv", name: "Louis Vuitton", domain: "louisvuitton.com", search: "louis vuitton runway", channel: "LV 路易威登", group: "designer"},
  {id: "lanvin", name: "Lanvin", domain: "lanvin.com", search: "lanvin runway", group: "designer"},
  {id: "raf", name: "Raf Simons", domain: "rafsimons.com", search: "raf simons runway", group: "designer"},
  {id: "acne", name: "Acne Studios", domain: "acnestudios.com", search: "acne studios runway", group: "designer"},
  {id: "dior", name: "Dior", domain: "dior.com", search: "dior runway", channel: "Dior 迪奥", group: "designer"},
  {id: "thombrowne", name: "Thom Browne", domain: "thombrowne.com", search: "thom browne runway", group: "designer"},
  {id: "prada", name: "Prada", domain: "prada.com", search: "prada runway", group: "designer"},
  {id: "zegna", name: "Zegna", domain: "zegna.com", search: "zegna runway", channel: "杰尼亚 Zegna", group: "designer"},
  {id: "loewe", name: "Loewe", domain: "loewe.com", search: "loewe runway", group: "designer"},
  {id: "celine", name: "Celine", domain: "celine.com", search: "celine runway", group: "designer"},
  {id: "hermes", name: "Hermès", domain: "hermes.com", search: "hermes runway", channel: "爱马仕 Hermes", group: "designer"},
  {id: "bv", name: "Bottega Veneta", domain: "bottegaveneta.com", search: "bottega veneta runway", channel: "葆蝶家 Bottega Veneta", group: "designer"},
  {id: "ysl", name: "Saint Laurent", domain: "ysl.com", search: "saint laurent runway", channel: "圣罗兰 Saint Laurent", group: "designer"},
  // 街头／机能
  {id: "gallerydept", name: "Gallery Dept.", domain: "gallerydept.com", search: "gallery dept fashion", group: "street"},
  {id: "jilsander", name: "Jil Sander", domain: "jilsander.com", search: "jil sander lookbook", group: "designer"},
  {id: "stoneisland", name: "Stone Island", domain: "stoneisland.com", search: "stone island fashion", group: "street"},
  {id: "fearofgod", name: "Fear of God", domain: "fearofgod.com", search: "fear of god essentials lookbook", group: "street"},
  {id: "arcteryx", name: "Arc'teryx", domain: "arcteryx.com", search: "arcteryx fashion", channel: "始祖鸟 Arc'teryx", group: "outdoor"},
  {id: "supreme", name: "Supreme", domain: "supremenewyork.com", search: "supreme lookbook", group: "street"},
  {id: "tnf", name: "The North Face", domain: "thenorthface.com", search: "the north face lookbook", channel: "北面 The North Face", group: "outdoor"},
  {id: "acoldwall", name: "A-COLD-WALL*", domain: "acoldwall.com", search: "a cold wall fashion", group: "street"},
  // Old money／静奢
  {id: "loropiana", name: "Loro Piana", domain: "loropiana.com", search: "loro piana lookbook", channel: "诺悠翩雅 Loro Piana", group: "oldmoney"},
  {id: "brunello", name: "Brunello Cucinelli", domain: "brunellocucinelli.com", search: "brunello cucinelli lookbook", group: "oldmoney"},
  {id: "colombo", name: "Colombo", domain: "colombomilano.com", search: "colombo cashmere fashion", group: "oldmoney"},
  {id: "placenaz", name: "Placenaz", search: "placenaz fashion", group: "oldmoney"},
  {id: "andremaurice", name: "André Maurice", search: "andre maurice fashion", group: "oldmoney"},
  {id: "boggi", name: "Boggi Milano", domain: "boggi.com", search: "boggi milano lookbook", group: "oldmoney"},
  // —— 连卡佛在售、可提供真实商品图的品牌（抓取库中有图） ——
  {id: "therow", name: "The Row", domain: "therow.com", search: "the row runway", group: "oldmoney"},
  {id: "miumiu", name: "Miu Miu", domain: "miumiu.com", search: "miu miu runway", group: "designer"},
  {id: "sacai", name: "Sacai", domain: "sacai.jp", search: "sacai runway", group: "designer"},
  {id: "dries", name: "Dries Van Noten", domain: "driesvannoten.com", search: "dries van noten runway", group: "designer"},
  {id: "ann", name: "Ann Demeulemeester", domain: "anndemeulemeester.com", search: "ann demeulemeester runway", group: "designer"},
  {id: "mm6", name: "MM6 Maison Margiela", domain: "maisonmargiela.com", search: "mm6 maison margiela", group: "designer"},
  {id: "moncler", name: "Moncler", domain: "moncler.com", search: "moncler lookbook", group: "outdoor"}
  ,
  // —— 补充品牌（设计师 / 静奢 / 街头 / 机能）——
  {id: "rickowens", name: "Rick Owens", domain: "rickowens.eu", search: "rick owens runway", group: "designer"},
  {id: "cdg", name: "Comme des Garçons", domain: "comme-des-garcons.com", search: "comme des garcons runway", group: "designer"},
  {id: "yohji", name: "Yohji Yamamoto", domain: "yohjiyamamoto.co.jp", search: "yohji yamamoto runway", group: "designer"},
  {id: "junya", name: "Junya Watanabe", domain: "junya-watanabe.jp", search: "junya watanabe runway", group: "designer"},
  {id: "issey", name: "Issey Miyake", domain: "isseymiyake.com", search: "issey miyake runway", group: "designer"},
  {id: "undercover", name: "Undercover", domain: "undercoverism.com", search: "undercover runway", group: "designer"},
  {id: "vivienne", name: "Vivienne Westwood", domain: "viviennewestwood.com", search: "vivienne westwood runway", group: "designer"},
  {id: "gucci", name: "Gucci", domain: "gucci.com", search: "gucci runway", channel: "古驰 Gucci", group: "designer"},
  {id: "fendi", name: "Fendi", domain: "fendi.com", search: "fendi runway", group: "designer"},
  {id: "tomford", name: "Tom Ford", domain: "tomford.com", search: "tom ford runway", group: "designer"},
  {id: "stella", name: "Stella McCartney", domain: "stellamccartney.com", search: "stella mccartney runway", group: "designer"},
  {id: "balmain", name: "Balmain", domain: "balmain.com", search: "balmain runway", group: "designer"},
  {id: "offwhite", name: "Off-White", domain: "off---white.com", search: "off white runway", group: "street"},
  {id: "amiri", name: "Amiri", domain: "amiri.com", search: "amiri lookbook", group: "street"},
  {id: "jacquemus", name: "Jacquemus", domain: "jacquemus.com", search: "jacquemus runway", group: "designer"},
  {id: "khaite", name: "Khaite", domain: "khaite.com", search: "khaite lookbook", group: "oldmoney"},
  {id: "marni", name: "Marni", domain: "marni.com", search: "marni runway", group: "designer"},
  {id: "ourlegacy", name: "Our Legacy", domain: "ourlegacy.com", search: "our legacy lookbook", group: "designer"},
  {id: "apc", name: "A.P.C.", domain: "apc.fr", search: "a.p.c. lookbook", group: "designer"},
  {id: "ald", name: "Aimé Leon Dore", domain: "aimeleondore.com", search: "aime leon dore lookbook", group: "street"},
  {id: "noah", name: "Noah", domain: "noahny.com", search: "noah lookbook", group: "street"},
  {id: "cpcompany", name: "C.P. Company", domain: "cpcompany.com", search: "cp company lookbook", group: "street"},
  {id: "carhartt", name: "Carhartt WIP", domain: "carhartt-wip.com", search: "carhartt wip lookbook", group: "street"},
  {id: "stussy", name: "Stüssy", domain: "stussy.com", search: "stussy lookbook", group: "street"},
  {id: "bape", name: "A Bathing Ape", domain: "bape.com", search: "bape lookbook", group: "street"},
  {id: "norrona", name: "Norrøna", domain: "norrona.com", search: "norrona lookbook", group: "outdoor"},
  {id: "patagonia", name: "Patagonia", domain: "patagonia.com", search: "patagonia lookbook", group: "outdoor"},
  {id: "snowpeak", name: "Snow Peak", domain: "snowpeak.com", search: "snow peak apparel", group: "outdoor"},
  {id: "salomon", name: "Salomon", domain: "salomon.com", search: "salomon lookbook", group: "outdoor"},
  {id: "hoka", name: "HOKA", domain: "hoka.com", search: "hoka lookbook", group: "outdoor"},
  {id: "nanamica", name: "Nanamica", domain: "nanamica.com", search: "nanamica lookbook", group: "outdoor"},
  {id: "andwander", name: "and wander", domain: "andwander.com", search: "and wander lookbook", group: "outdoor"},
  {id: "veilance", name: "Arc'teryx Veilance", domain: "veilance.com", search: "veilance lookbook", group: "outdoor"},
  {id: "mammut", name: "Mammut", domain: "mammut.com", search: "mammut lookbook", group: "outdoor"},
  // —— 静奢 / 鞋履与手袋 ——
  {id: "kiton", name: "Kiton", domain: "kiton.com", search: "kiton lookbook", group: "oldmoney"},
  {id: "canali", name: "Canali", domain: "canali.com", search: "canali lookbook", group: "oldmoney"},
  {id: "smedley", name: "John Smedley", domain: "johnsmedley.com", search: "john smedley knitwear", group: "oldmoney"},
  {id: "sunspel", name: "Sunspel", domain: "sunspel.com", search: "sunspel lookbook", group: "oldmoney"},
  {id: "barbour", name: "Barbour", domain: "barbour.com", search: "barbour lookbook", group: "oldmoney"},
  {id: "allude", name: "Allude", domain: "allude.de", search: "allude cashmere", group: "oldmoney"},
  {id: "commonprojects", name: "Common Projects", domain: "commonprojects.com", search: "common projects sneakers", group: "designer"},
  {id: "drmartens", name: "Dr. Martens", domain: "drmartens.com", search: "dr martens lookbook", group: "street"},
  {id: "newbalance", name: "New Balance", domain: "newbalance.com", search: "new balance lookbook", group: "street"},
  {id: "asics", name: "ASICS", domain: "asics.com", search: "asics lookbook", group: "street"}
];

export const BRAND_GROUPS: {id: Brand["group"]; label: {zh: string; en: string}}[] = [
  {id: "designer", label: {zh: "设计师与时装屋", en: "Designers & maisons"}},
  {id: "oldmoney", label: {zh: "静奢 / Old money", en: "Quiet luxury"}},
  {id: "street", label: {zh: "街头与潮流", en: "Street & hype"}},
  {id: "outdoor", label: {zh: "机能与户外", en: "Technical & outdoor"}}
];

/** 把品牌域名加入图片"品牌官方"白名单。 */
export const brandDomains = () =>
  BRANDS.map(brand => brand.domain).filter((domain): domain is string => Boolean(domain));

export const brandById = (id: string) => BRANDS.find(brand => brand.id === id);

export const brandChannelQuery = (brand: Brand) => brand.channel ?? brand.name;
