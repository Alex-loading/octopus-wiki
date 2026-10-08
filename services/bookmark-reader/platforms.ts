import { PLATFORMS, type BookmarkPlatform } from "../../src/app/content/bookmarks.ts";

export type ReaderPlatform = {
  id: Exclude<BookmarkPlatform, "other">;
  label: string;
  pageHosts: string[];
  authHosts: string[];
  resourceDomains: string[];
  loginUrl: string;
  defaultTitle: RegExp;
  loginSelectors: string[];
  verificationSelectors: string[];
};

export const READER_PLATFORMS: ReaderPlatform[] = [
  {
    id: "xiaohongshu", label: PLATFORMS.xiaohongshu.label,
    pageHosts: ["xiaohongshu.com", "www.xiaohongshu.com", "m.xiaohongshu.com", "xhslink.com", "www.xhslink.com", "xhslink.cn"],
    authHosts: [],
    resourceDomains: ["xiaohongshu.com", "xhscdn.com", "xhscdn.net", "xhslink.com", "xhslink.cn"],
    loginUrl: "https://www.xiaohongshu.com/login",
    defaultTitle: /^小红书(?:\s*[-—|]\s*你的生活兴趣社区)?$/u,
    loginSelectors: [".login-container", ".login-modal"],
    verificationSelectors: ["#captcha", ".captcha-container"],
  },
  {
    id: "douyin", label: PLATFORMS.douyin.label,
    pageHosts: ["douyin.com", "www.douyin.com", "v.douyin.com", "www.iesdouyin.com"],
    authHosts: ["sso.douyin.com", "sso.iesdouyin.com", "aweme.snssdk.com"],
    resourceDomains: ["douyin.com", "iesdouyin.com", "douyinstatic.com", "douyinpic.com", "douyinvod.com", "bytegoofy.com", "bytetos.com", "bytescm.com", "yhgfb-cn-static.com", "applogcdn.com", "ibytedapm.com", "byteimg.com", "zijieapi.com", "snssdk.com", "pstatp.com", "geetest.com", "bytegecko.com", "bytednsdoc.com", "bytedance.com"],
    loginUrl: "https://www.douyin.com/",
    defaultTitle: /^抖音(?:\s*[-—|]\s*(?:记录美好生活|让每一个人看见并连接更大的世界))?$/u,
    loginSelectors: ["[data-e2e='login-modal']", ".login-panel"],
    verificationSelectors: ["#captcha_container", "#verify-bar-code", ".captcha_verify_container"],
  },
  {
    id: "bilibili", label: PLATFORMS.bilibili.label,
    pageHosts: ["bilibili.com", "www.bilibili.com", "m.bilibili.com", "space.bilibili.com", "b23.tv", "www.b23.tv"],
    authHosts: ["passport.bilibili.com"],
    resourceDomains: ["bilibili.com", "b23.tv", "hdslb.com", "biliimg.com", "bilivideo.com", "geetest.com", "geevisit.com"],
    loginUrl: "https://passport.bilibili.com/login",
    defaultTitle: /^(?:哔哩哔哩|bilibili|哔哩哔哩\s*\(゜-゜\)つロ\s*干杯[~～-]*\s*bilibili|哔哩哔哩弹幕视频网)$/iu,
    loginSelectors: [".bili-mini-login", ".login-scan-box"],
    verificationSelectors: [".geetest_panel", ".geetest_holder"],
  },
  {
    id: "nowcoder", label: PLATFORMS.nowcoder.label,
    pageHosts: ["nowcoder.com", "www.nowcoder.com", "m.nowcoder.com", "ac.nowcoder.com"],
    authHosts: ["passport.nowcoder.com"],
    resourceDomains: ["nowcoder.com", "nowcoder.net", "geetest.com", "geevisit.com"],
    loginUrl: "https://www.nowcoder.com/login",
    defaultTitle: /^牛客(?:网)?(?:\s*[-—_|]\s*(?:找工作神器|互联网求职神器))?$/u,
    loginSelectors: [".login-wrapper", ".login-modal"],
    verificationSelectors: [".geetest_panel", ".geetest_holder"],
  },
  {
    id: "wechat", label: PLATFORMS.wechat.label,
    pageHosts: ["mp.weixin.qq.com"],
    authHosts: ["open.weixin.qq.com", "login.weixin.qq.com"],
    resourceDomains: ["weixin.qq.com", "qpic.cn", "qlogo.cn", "wx.qq.com", "res.wx.qq.com", "tenpay.com"],
    loginUrl: "https://mp.weixin.qq.com/",
    defaultTitle: /^(?:微信公众平台|微信公众号|微信安全中心)$/u,
    loginSelectors: [".login__type__container__scan", "#login_container"],
    verificationSelectors: ["#js_verify", "#verify_container"],
  },
];
