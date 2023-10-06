<template>
  <div>
    <div v-for="(font, index) in store.fonts" :key="index" class="font-set">
      <div class="attr">
        <label>Fontface</label>
        <textarea v-model="font.fontfaceName" type="text" />
      </div>

      <div class="attr">
        <label>Local</label>
        <textarea v-model="font.localFontName" type="text" />
      </div>

      <div class="attr">
        <label>Google</label>
        <textarea v-model="font.googleFontName" type="text" />
      </div>

      <div class="attr" v-if="font.fontfaceName" title="font weight bias">
        <label>Weight±</label>
        <textarea
          v-if="font.fontfaceName"
          v-model="font.fontWeightBias"
          type="text"
        />
      </div>

      <div class="attr" v-if="font.fontfaceName">
        <label>Text</label>
        <textarea
          v-if="font.fontfaceName"
          v-model="font.characters"
          type="text"
        />
      </div>

      <div class="action-wrapper">
        <div>
          <button @click="removeFont(index)" class="delete-btn">Delete</button>
          <button
            @click="moveFontUp(index)"
            class="move-up-btn"
            :disabled="index === 0"
          >
            ↑
          </button>
          <button
            @click="moveFontDown(index)"
            class="move-down-btn"
            :disabled="index === store.fonts.length - 1"
          >
            ↓
          </button>
        </div>
      </div>
    </div>

    <div id="add-btn">
      <button @click="addFont">Add Font Set</button>
    </div>
  </div>
</template>

<script setup>
import { useStore } from "@/store";
import { ref, watch, onMounted } from "vue";

const store = useStore();

function addFont() {
  console.log("add font");
  store.fonts.push({
    fontfaceName: "",
    localFontName: "",
    googleFontName: "",
    characters: "",
  });
}

function removeFont(index) {
  console.log("remove font");
  store.fonts.splice(index, 1);
}

function moveFontUp(index) {
  if (index > 0) {
    const temp = store.fonts[index];
    store.fonts.splice(index, 1);
    store.fonts.splice(index - 1, 0, temp);
  }
}

function moveFontDown(index) {
  if (index < store.fonts.length - 1) {
    const temp = store.fonts[index];
    store.fonts.splice(index, 1);
    store.fonts.splice(index + 1, 0, temp);
  }
}
</script>

<style lang="scss">
#form-wrapper {
  overflow-y: auto;
  position: static;
}
.font-set {
  padding: 1rem;
  border-bottom: 1px solid;
  position: relative;
  // position: static;

  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(25ch, 1fr));
  grid-gap: 0.5em 1em;

  .attr {
    display: grid;
    grid-template-columns: 8ch 1fr;
    grid-gap: 1ch;
    label {
      text-align: right;
      padding: calc((var(--input-height) - var(--line-height)) / 2) 0;
    }
    textarea {
      // position: absolute;
      // width: 100%;
    }
  }

  .action-wrapper {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    padding: 0.5rem;
    background: #000c;
    z-index: 999;
    opacity: 0.25;
    display: flex;
    align-items: center;
    transform: translateX(calc(-100% + 0.25rem));
    transition: all 0.3s;
    & > div {
      display: grid;
      grid-template-areas:
        "del del"
        "up down";
      grid-gap: 0.5rem;
    }
    button {
      border-radius: 0.25rem;
    }
    .delete-btn {
      grid-area: del;
    }
    .move-up-btn {
      grid-area: up;
    }
    .move-down-btn {
      grid-area: down;
    }
  }
  &:hover .action-wrapper {
    transform: translateX(calc(-100% + 0.5rem));

    &:hover {
      opacity: 1;
      transform: translateX(0em);
    }
  }
}

#add-btn {
  padding: 1rem;
  button {
    width: 100%;
    border-radius: 2em;
    border: none;
    line-height: 2;
  }
}
</style>
