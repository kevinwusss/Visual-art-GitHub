import type {NextConfig} from "next";

/**
 * 之所以现在才需要这个文件：页面上的图片全部走同源代理
 * （/api/image?src=... 与 /api/uploads/...），没有跨域图片直出，
 * 因此不需要配 images.remotePatterns，也用不上 next/image 的远程白名单。
 * 这里只做最基础的收尾。
 */
const config: NextConfig = {
  // 去掉响应头里的 X-Powered-By，不为攻击者提供额外的版本线索
  poweredByHeader: false
};

export default config;
