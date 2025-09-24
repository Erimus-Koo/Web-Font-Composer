<template>
  <div>
    <!-- tab - start -->
    <div class="tab-bar">
      <button
        v-for="tab in store.previewTabs"
        :key="tab"
        :class="{ active: store.previewTabActive === tab }"
        @click="store.previewTabActive = tab"
      >
        {{ tab }}
      </button>
    </div>
    <!-- tab - end -->

    <div class="tab-content">
      <!-- code preview - start -->
      <Codemirror
        id="user-style"
        v-if="store.previewTabActive === 'Code Preview'"
        v-model:value="store.optionStyle"
        :options="codePreviewOption"
      />
      <!-- code preview - end -->

      <!-- font preview - start -->
      <div v-if="store.previewTabActive === 'Font Preview'">
        <PreviewOption />
        <div class="preview">
          <div v-for="w in 18" :key="w">
            <code>{{ String(w * 50).padStart(3, "0") }}</code>
            <span
              :style="`
                font-weight: ${w * 50};
                font-size: ${store.fontSize}px;
                ${store.isItalic ? 'font-style: italic;' : ''}
              `"
            >
              {{ store.sampleText }}
            </span>
          </div>
        </div>
      </div>
      <!-- font preview - end -->

      <!-- debug - start -->
      <Codemirror
        v-if="store.previewTabActive === 'Debug'"
        v-model:value="store.debug"
        :options="debugPreviewOption"
      />

      <!-- debug - end -->
    </div>
  </div>
</template>

<script setup>
import { useStore } from "@/store";
import { ref, watch, onMounted } from "vue";
import PreviewOption from "@/components/PreviewOption.vue";

const store = useStore();

import "codemirror/mode/css/css.js";
import "codemirror/mode/javascript/javascript.js";
import "codemirror/theme/dracula.css";
// https://codemirror.net/5/doc/manual.html#config
const codePreviewOption = {
  mode: "text/css", // Language mode
  theme: "dracula", // Theme
  lineWrapping: true, // Line Wrap
  readOnly: true,
  cursorBlinkRate: -1,
};
const debugPreviewOption = {
  mode: "text/javascript", // Language mode
  theme: "dracula", // Theme
  lineWrapping: true, // Line Wrap
  readOnly: true,
  cursorBlinkRate: -1,
};
</script>

<style lang="scss" scoped>
#preview-wrapper {
  display: flex;
  flex-flow: column nowrap;
  background: pink;
}
.tab-content {
  overflow-y: auto;
  flex-grow: 1;
  position: relative;

  .codemirror-container {
    position: absolute;
  }
}
.preview {
  padding: 1rem;

  code {
    margin-right: 1ch;
  }
}
</style>
