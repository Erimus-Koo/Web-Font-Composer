import { createApp } from "vue";
import "./style.scss";
import App from "./App.vue";
import { store } from "@/store/index.js";
import { InstallCodemirro } from "codemirror-editor-vue3";

const app = createApp(App);
app.use(store);
app.use(InstallCodemirro);
app.mount("#app");
