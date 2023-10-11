<template>
  <div id="main-wrapper">
    <Sidebar id="sidebar-wrapper" />
    <resizeHandler />
    <Preview id="preview-wrapper" />
    <resizeHandler :prevMinSize="500" />
    <div
      id="test-panel"
      style="
        width: 200px;
        border-left: 0px solid;
        display: flex;
        flex-flow: column nowrap;
        height: 100%;
      "
    >
      <div id="top-panel" style="height: 100%" />
      <resizeHandler />
      <div id="center-panel" style="height: 100%" />
      <resizeHandler />
      <div
        id="bottom-panel"
        style="height: 100%; background: lightgreen; outline: 0px solid"
      />
    </div>
    <resizeHandler />
    <div id="last" style="background: rosybrown; border-left: 0px solid" />
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
  // min-width: 500px;
}
</style>
