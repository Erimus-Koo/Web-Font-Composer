import { createPinia } from "pinia";
import { defineStore } from "pinia";
import piniaPluginPersist from "pinia-plugin-persist";

const pinia = createPinia();
pinia.use(piniaPluginPersist);
export const store = pinia;

export const useStore = defineStore("form", {
  state: () => ({
    // UI
    sidebarTabs: ["Options", "User Style"],
    sidebarTabActive: "Options",
    previewTabs: ["Code Preview", "Font Preview", "Debug"],
    previewTabActive: "Font Preview",
    panelSize: {},

    // options
    fonts: [
      {
        fontfaceName: "Emoji",
        localFontName: "AppleColorEmoji, Segoe UI Emoji, Noto Color Emoji",
        googleFontName: "",
        fontWeightBias: "",
        characters: "U+300-FFFF",
      },
      {
        fontfaceName: "Number",
        localFontName: "",
        googleFontName: "Barlow",
        fontWeightBias: "1",
        characters: "1-23,45全聚/感ABC@abc+67.890%",
      },
      // 添加更多字体项...
    ],

    // preview options
    sampleText: "12345全聚感ABCabc67890",
    fontSize: 30,
    isItalic: false,

    // css code
    optionStyle: "",
    userStyle: "",

    // misc
    shareFunc: {}, //跨组件共享函数
  }),
  actions: {},
  getters: {
    options() {
      return JSON.stringify(this.fonts);
    },
    debug() {
      const copy = { ...this };
      for (let key of [
        "fonts",
        "optionStyle",
        "userStyle",
        "options",
        "debug",
      ]) {
        delete copy[key];
      }
      return JSON.stringify(copy, null, 2);
    },
  },
  persist: {
    enabled: true, // 启用持久化
    strategies: [
      {
        storage: localStorage,
        paths: [
          "fonts",
          "sampleText",
          "fontSize",
          "isItalic",
          "userStyle",
          "sidebarTabActive",
          "previewTabActive",
          "panelSize",
        ],
      },
    ],
  },
});
