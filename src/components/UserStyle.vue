<template>
  <div>
    <Codemirror
      id="user-style"
      v-model:value="store.userStyle"
      :options="cmOptions"
    />
  </div>
</template>

<script setup>
import { useStore } from "@/store";
import { ref, watch } from "vue";

const store = useStore();

import "codemirror/mode/css/css.js";
import "codemirror/theme/dracula.css";
// https://codemirror.net/5/doc/manual.html#config
const cmOptions = {
  mode: "text/css", // Language mode
  theme: "dracula", // Theme
  lineWrapping: true, // Line Wrap
};
</script>

<style scoped>
#user-style-wrapper {
  display: grid;
}
#user-style {
  font-family: monospace;
  white-space: pre-wrap;
  display: block;
  width: 100% !important;
  height: 100% !important;
  border: none;
  border-radius: unset;
  background: #f222;
  color: #3c3;
  /* padding: 1rem; */
}
</style>
