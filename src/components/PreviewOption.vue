<template>
  <div id="preview-option-wrapper">
    <label class="sample-text">
      Sample Text
      <input type="text" placeholder="sample text" v-model="store.sampleText" />
    </label>
    <label class="font-size">
      Font Size
      <input type="number" v-model="store.fontSize" />
    </label>
    <label class="is-italic">
      <input type="checkbox" v-model="store.isItalic" /> <em>Italic</em>
    </label>
  </div>
</template>

<script setup>
import { useStore } from "@/store";
import { ref, watch } from "vue";

const store = useStore();
</script>

<style lang="scss">
#preview-option-wrapper {
  position: sticky;
  top: 0;
  padding: 0.5rem 1rem;
  // height: var(--tab-height);
  line-height: calc(var(--tab-height) - 1rem);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10ch, 2fr));
  grid-gap: 0.5rem 1rem;
  align-items: center;
  background: #06fc;
  color: #fff;
  // border-bottom: 1px solid;

  label {
    display: flex;
    align-items: center;
    height: calc(var(--tab-height) - 1rem);
  }
  input {
    height: var(--input-height);
  }
}
.sample-text {
  display: grid !important;
  grid-column: span 2;
  grid-template-columns: 12ch 1fr;
  input {
    width: 100%;
  }
}
.font-size {
  // width: 8rem;
  input {
    max-width: 3rem;
    margin-left: 0.5em;
  }
}
.is-italic {
  input[type="checkbox"] {
    -webkit-appearance: none;
    appearance: none;
    background: white;
    margin-right: 0.5rem;
    display: grid;
    // border-radius: 1rem;
    place-content: center;
    &::before {
      content: "";
      display: block;
      width: 0.8rem;
      height: 0.4rem;
      // border: 0.25rem solid #393;

      border-left: 0.25rem solid #393;
      border-bottom: 0.25rem solid #393;
      transform: scale(0) translate(0rem, -0.1rem) rotate(-45deg);
      transition: transform cubic-bezier(0.5, -1, 1, 1) 0.2s;
    }
    &:checked::before {
      transform: scale(1) translate(0rem, -0.1rem) rotate(-45deg);
      transition: transform cubic-bezier(0.2, 1, 0.5, 2) 0.2s;
    }
  }
}
</style>
