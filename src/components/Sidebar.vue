<template>
  <div>
    <div class="tab-bar">
      <button
        v-for="tab in store.sidebarTabs"
        :key="tab"
        :class="{ active: store.sidebarTabActive === tab }"
        @click="swicthSidebarTab(tab)"
      >
        {{ tab }}
      </button>
    </div>
    <Form v-if="store.sidebarTabActive === 'Options'" id="form-wrapper" />
    <UserStyle v-else id="user-style-wrapper" />
  </div>
</template>

<script setup>
import { useStore } from "@/store";
import { ref, watch, onMounted } from "vue";

import Form from "@/components/Form.vue";
import UserStyle from "@/components/UserStyle.vue";

const store = useStore();

function swicthSidebarTab(tab) {
  store.sidebarTabActive = tab;
  if (tab === "Options") {
    injectStyles("option-style");
  } else if (tab === "User Style") {
    injectStyles("user-style");
  }
}

function generateGoogleFontRequest(name) {
  name = name.replace(" ", "+");
  let ital_wght_list = [];
  for (let ital of Array(2).keys()) {
    for (let w of Array(9).keys()) {
      ital_wght_list.push(`${ital},${w + 1}00`);
    }
  }
  const ital_wght = `ital,wght@${ital_wght_list.join(";")}`;
  const url = `https://fonts.googleapis.com/css2?family=${name}:${ital_wght}&display=swap`;
  return url;
}

async function fetchGoogleFont(font) {
  // 返回特定google字体的url 用于font-face 所以一般一次只有一个字体
  let googleFontDict = {}; //{fontname:{fontStyle:{fontWeight:src}}}
  console.log(`Fetch Google Font to extract subset: ${font}`);

  const url = generateGoogleFontRequest(font);
  // console.log("url:", url);
  const response = await fetch(url);
  console.log("response:", response);
  const text = await response.text();
  // console.log("text:", text);
  const fontFaces = text.match(/\/\* latin \*\/\s@font-face.*?}/gms);
  // console.log("fontFaces:", fontFaces);

  if (fontFaces) {
    fontFaces.forEach((fontFace) => {
      const fontStyle = fontFace.match(/font-style: (normal|italic);/);
      const fontWeight = fontFace.match(/font-weight: (\d+)/);
      const src = fontFace.match(/src: (.*);/);
      // console.log(`${fontStyle} | ${fontWeight} | ${src}`);

      if (fontStyle && fontWeight && src) {
        const fontStyleValue = fontStyle[1];
        const fontWeightValue = fontWeight[1];
        const srcValue = src[1];
        // console.log(`${fontStyleValue} | ${fontWeightValue} | ${srcValue}`);

        if (!googleFontDict[fontStyleValue]) {
          googleFontDict[fontStyleValue] = {};
        }

        googleFontDict[fontStyleValue][fontWeightValue] = srcValue;
      }
    });
  }
  console.log("🏀 googleFontDict:", googleFontDict);
  return googleFontDict;
}

function convertStringToUnicode(str) {
  if (!str) return "";

  // 步骤 1: 将字符串中的字符正序排序
  const charList = str.split("").sort();

  // 步骤 2: 逐字转换为Unicode码
  let unicodeList = [];
  for (const char of charList) {
    unicodeList.push(char.charCodeAt(0));
  }
  // console.log("unicodeList:", unicodeList);

  // 步骤 3: 将连续的码合并为 U+start-end 的形式
  let result = [];
  let start = unicodeList[0];
  let end = unicodeList[0];
  for (let i = 1; i <= unicodeList.length; i++) {
    const unicode = unicodeList[i];
    // console.log("unicode:", unicode);
    if (unicode - end === 1 && i < unicodeList.length) {
      // 连续 啥都不干 继续
      // console.log("连续");
      end = unicode;
      continue;
    } else {
      // 不连续 准备拼接
      // console.log("不连续 xxx");
      if (end === start) {
        // 单个字符
        result.push(`U+${start.toString(16).toUpperCase()}`);
      } else {
        // 连续字符
        result.push(
          `U+${start.toString(16).toUpperCase()}-${end
            .toString(16)
            .toUpperCase()}`
        );
      }
      start = unicode;
      end = unicode;
    }
    // console.log("result:", result);
  }
  result = result.join(", ");
  return result;
}

const calcFontStyleCode = async (fontList) => {
  console.log("start calc >>>>>>>>>>>");
  const importList = [];
  const styles = []; //样式表 import font-face
  let fontFamily = []; //指定字体

  // 遍历每一条样式
  for (const fontSet of fontList) {
    const {
      fontfaceName,
      localFontName,
      googleFontName,
      fontWeightBias,
      characters,
    } = fontSet;
    console.log("---\nfontfaceName:", fontfaceName);
    console.log("localFontName:", localFontName);
    console.log("googleFontName:", googleFontName);
    console.log("characters:", characters);

    let localFontList = localFontName
      .split(",")
      .map((n) => n.replace(/^\s*"?([^"]*)"?\s*$/, "$1"))
      .filter((n) => n);
    console.log("-> localFontList:", localFontList);

    let googleFontList = googleFontName
      .split(",")
      .map((n) => n.replace(/^\s*"?([^"]*)"?\s*$/, "$1"))
      .filter((n) => n);
    console.log("-> googleFontList:", googleFontList);

    if (fontfaceName && characters) {
      // 形成font face ----------------------------------

      // 处理 google font
      let googleFontDict = {};
      if (googleFontList.length > 0) {
        const font = googleFontList[0];
        googleFontDict = await fetchGoogleFont(font);
      }
      console.log("🏐 googleFontDict:", googleFontDict);

      // 处理 unicode range
      let unicodeRange = characters;
      if (!characters.startsWith("U+")) {
        unicodeRange = convertStringToUnicode(characters);
      }

      // 特殊处理 Emoji
      if (fontfaceName.toLowerCase() === "emoji") {
        styles.push(`@font-face {
        font-family: "${fontfaceName}";
        src: ${localFontList.map((font) => `local("${font}")`).join(", ")};
        unicode-range: ${unicodeRange};
      }\n`);
        fontFamily.push(fontfaceName);
        continue;
      }

      // 处理字重偏移
      const fontWeightBiasList = Array(9).fill(0);
      if (fontWeightBias) {
        if (fontWeightBias.includes(",")) {
          const values = fontWeightBias.split(",");
          for (let i = 0; i < values.length && i < 9; i++) {
            fontWeightBiasList[i] = parseInt(values[i]);
          }
        } else {
          const value = parseInt(fontWeightBias);
          fontWeightBiasList.fill(value);
        }
        console.log("fontWeightBiasList:", fontWeightBiasList);
      }

      for (let fontStyle of ["normal", "italic"]) {
        for (let i of Array(9).keys()) {
          let fontList = [];
          // 处理 local
          localFontList.forEach((font) => fontList.push(`local("${font}")`));

          const weight = (i + 1) * 100;
          const bias = fontWeightBiasList[i];
          i = parseInt(i + 1 + bias);
          i = Math.min(Math.max(i, 1), 9);
          const weightBias = i * 100;
          if (bias != 0) {
            console.log(`${weight} (${bias}) -> ${weightBias}`);
          }
          // font face 需要按字重字型为组来处理
          const src = googleFontDict[fontStyle]?.[weightBias];
          // console.log("src:", src);
          if (src) {
            fontList.push(src);
          }

          // console.log("fontList:", fontList);
          if (fontList.length > 0) {
            styles.push(`@font-face {
  font-family: "${fontfaceName}";
  font-style: ${fontStyle};
  font-weight: ${weight};
  font-display: swap;
  src: ${fontList.join(", ")};
  unicode-range: ${unicodeRange};
}\n`);
          }
        }
      }
      // console.log("styles:", styles);

      // 加入font family
      fontFamily.push(`"${fontfaceName}"`);
    } else {
      // 直接导入google fonts或者使用本地字体 ------------------------
      console.log("Not fontface and characters", googleFontList.length);
      // 导入google font
      googleFontList.forEach((font) => {
        importList.push(`@import url('${generateGoogleFontRequest(font)}');\n`);
      });

      // 加入font-family
      const allFont = localFontList.concat(googleFontList);
      // console.log("allFont:", allFont);
      allFont.forEach((font) => {
        if (font && !fontFamily.includes(`"${font}"`)) {
          fontFamily.push(`"${font}"`);
        }
      });
    }
  }

  let styleContent = importList.concat(styles).join("\n");

  console.log("fontFamily:", fontFamily);
  const fontFamilyValue = fontFamily.join(", ");
  const fontFamilyContent = `\n#preview-wrapper {\n  font-family: ${fontFamilyValue};\n}`;
  styleContent += fontFamilyContent;
  // console.log("styleContent:", styleContent);

  return styleContent;
};

injectStyles("user-style");
injectStyles("option-style");

watch(
  () => store.options,
  async () => {
    await injectStyles("option-style");
  }
);

watch(
  () => store.userStyle,
  async () => {
    await injectStyles("user-style");
  }
);

async function injectStyles(name) {
  // 插入样式
  console.log("🐒inject!!!", name);
  let fontStyle = "";
  if (name === "option-style") {
    fontStyle = await calcFontStyleCode(store.fonts);
    store.optionStyle = fontStyle;
  } else {
    fontStyle = store.userStyle;
  }

  name = "inject-style";
  // 移除之前插入的
  const existingStyleElement = document.querySelector(`#${name}`);
  if (existingStyleElement) {
    existingStyleElement.remove();
  }

  // 插入新样式
  const styleElement = document.createElement("style");
  styleElement.id = name;
  styleElement.setAttribute("type", "text/css");
  styleElement.textContent = `${fontStyle}`;
  const bodyElement = document.body;
  const nextSibling = bodyElement.nextSibling;
  bodyElement.parentNode.insertBefore(styleElement, nextSibling);
}
</script>

<style lang="scss">
#sidebar-wrapper {
  display: flex;
  flex-flow: column nowrap;
}
#form-wrapper {
  // background: lightgreen;
  // width: clamp(200px, 25vw, 400px);
  height: 100%;
}

#user-style-wrapper {
  // width: clamp(200px, 25vw, 400px);
  height: 100%;
  background: #222;
  margin: 0;
}

.CodeMirror {
  clip-path: none !important;
}
</style>
