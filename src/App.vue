<template>
  <div id="main-wrapper">
    <Sidebar id="sidebar-wrapper" />
    <resizeHandler />
    <Preview id="preview-wrapper" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
const store = useStore();

import Sidebar from "@/components/Sidebar.vue";
import Preview from "@/components/Preview.vue";
import resizeHandler from "@/components/utils/resizeHandler.vue";
</script>

<style lang="scss">
#main-wrapper {
  display: flex;
  // flex-direction: column;
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: #ff02;
  & > * {
    flex-grow: 1;
  }
}

#sidebar-wrapper {
  background: skyblue;
  // border-right: 1px solid;
}

#preview-wrapper {
  width: 100%;
  min-width: 500px;
}
</style>
