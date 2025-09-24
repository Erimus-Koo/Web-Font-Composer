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
        characters:
          "U+1F300-1F5FF, U+1F600-1F64F, U+1F680-1F6FF, U+2600-26FF, U+2700-27BF, U+1F1E6-1F1FF, U+1F900-1F9FF, U+1FA70-1FAFF",
      },
      {
        fontfaceName: "Number",
        localFontName: "",
        googleFontName: "Barlow",
        fontWeightBias: "1",
        characters: "1234567890,.+-%/\\@",
      },
      // 添加更多字体项...
    ],

    // preview options
    sampleText: "1-23,45全聚/感ABC@abc+67.890%",
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
