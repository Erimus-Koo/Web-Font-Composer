<!-- 
- This is a resize handler.
- Direction could be LR(left/right) or TB(top/bottom)
- The siblings are named prev(top/left) and next(bottom/right) 
 -->
<template>
  <div
    class="resize-handler"
    v-bind="$attrs"
    :style="
      '--size:' +
      size +
      'px;--hover-size:' +
      hoverSize +
      'px;--color:' +
      color +
      ';--indicator-size:' +
      indicatorSize +
      'px;--indicator-color:' +
      indicatorColor
    "
    ref="refHandler"
  >
    <!-- display while mouse hover & expand hover area -->
    <div class="hover-indicator" />

    <!-- the collapse buttons -->
    <div class="collapse-btn prev"></div>
    <div class="collapse-btn next"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
const props = withDefaults(
  defineProps<{
    prevMinSize?: number; // the min size of panel (left/top)
    nextMinSize?: number; // the min size of panel (right/bottom)

    // normal status
    size?: number;
    hoverSize?: number; // extra size for hover, invisible, hoverable
    color?: string;

    // hover indicator
    indicatorSize?: number;
    indicatorColor?: string;
  }>(),
  {
    prevMinSize: 200,
    nextMinSize: 200,
    size: 10,
    hoverSize: 20,
    color: "#f009",
    indicatorSize: 4,
    indicatorColor: "#06f",
  }
);

const debug = (...args) => {
  // return;
  console.debug("[📏]", ...args);
};

const refHandler = ref(); // element
let direction = ""; // LR or TB
let dimension = ""; // width or height

// ------------------------------ store size - START
const lsKey = "panelSize"; // local storage key of panel size
const loadSize = (
  panelId: string | null = null, //panel id
  key: string = lsKey //store name
): Object => {
  debug("Save: panelId=", panelId, "key=", key);
  const storedObj = JSON.parse(localStorage.getItem(key) || "{}");
  const result = panelId ? storedObj[panelId] || {} : storedObj;
  debug("Load: panelId=", panelId, "key=", key, "result=", result);
  return result;
};
const saveSize = (
  panelId: string, //panel id
  sizeObj: Object, //size dictionary
  key: string = lsKey //store name
): void => {
  debug("Save: panelId=", panelId, "sizeObj=", sizeObj, "key=", key);
  const storedObj = loadSize(null, key);
  storedObj[panelId] = sizeObj;
  localStorage.setItem(key, JSON.stringify(storedObj));
};
// ------------------------------ store size - END

// ------------------------------ drag - START
// 拖动对象边缘改变其大小
// TODO: 直接在JS内创建拖动把手 把方法直接添加到element上
function initHandler(
  handler: HTMLElement, // element
  collapseThreshold: number = 100 // if panel size less than this value, panel collapse
): void {
  console.group("drag event init", handler);

  // Define siblings
  let prevEle = handler.previousElementSibling as HTMLElement;
  let nextEle = handler.nextElementSibling as HTMLElement;
  let prevRect = prevEle?.getBoundingClientRect();
  let nextRect = nextEle?.getBoundingClientRect();
  debug("[0]Prev Node:", prevEle, prevRect);
  debug("[0]Next Node:", nextEle, nextRect);
  if (!(prevEle && nextEle)) return; // Do not resize without siblings

  // Define vaiables and common functions
  let start = 0; // Previous node top/left
  let end = window.innerWidth; // Next node bottom/right

  const clamp = (v) =>
    Math.min(Math.max(v, start + props.prevMinSize), end - props.nextMinSize);

  // Determine the handler direction by siblings
  if (
    Math.abs(prevRect.y - nextRect.y) < 1 &&
    Math.abs(prevRect.height - nextRect.height) < 1
  ) {
    direction = "LR";
  } else if (
    Math.abs(prevRect.x - nextRect.x) < 1 &&
    Math.abs(prevRect.width - nextRect.width) < 1
  ) {
    direction = "TB";
  }
  handler.classList.add(direction);
  dimension = direction === "LR" ? "width" : "height";
  debug("handlerDirection:", direction, dimension, prevRect, nextRect);

  // -------------------- Drag start - START
  const dragStart = () => {
    debug("Drag Start");

    const halfSize = props.size / 2;
    // debug("halfSize:", halfSize);

    // Prevent text be selected while mouse move
    document.body.classList.add("on-dragging");

    setAllSiblingsSize(handler);
    // ------------------------------ Write all siblings' size - END

    // Get siblings
    prevRect = prevEle.getBoundingClientRect();
    nextRect = nextEle.getBoundingClientRect();
    debug("[1]Prev Node:", prevEle, prevRect);
    debug("[1]Next Node:", nextEle, nextRect);

    if (direction === "LR") {
      start = prevRect.x;
      end = nextRect.x + nextRect.width;
    } else if (direction === "TB") {
      start = prevRect.y;
      end = nextRect.y + nextRect.height;
    } else {
      debug("No match found");
      console.groupEnd();
      return;
    }
    debug("direction:", direction, [start, end]);

    // -------------------- Drag move - START
    const dragMove = (e) => {
      // Calculate siblings' size
      const current = parseInt(direction === "LR" ? e.clientX : e.clientY);
      let prevSize = prevRect[dimension];
      let nextSize = nextRect[dimension];
      if (
        start + collapseThreshold <= current &&
        current <= end - collapseThreshold
      ) {
        // Between the sublings
        prevSize = clamp(current - halfSize) - start;
      } else if (current < start + collapseThreshold) {
        // Collapse prev
        prevSize = 0;
      } else if (current > end - collapseThreshold) {
        // Collapse next
        prevSize = end - start - props.size;
      }
      nextSize = end - start - props.size - prevSize;

      // Set the size of siblings
      prevEle.style[dimension] = `${prevSize}px`;
      nextEle.style[dimension] = `${nextSize}px`;
      debug(
        `Range:${Math.round(start)}-${Math.round(end)} | Current:${Math.round(
          current
        )} | ${Math.round(prevSize)} + ${Math.round(nextSize)} = ${Math.round(
          prevSize + nextSize
        )}`
      );
    };
    document.onmousemove = dragMove;
    document.ontouchmove = dragMove;
    // -------------------- Drag move - END

    // -------------------- Drag end - START
    const dragEnd = () => {
      document.onmousemove = null;
      document.ontouchmove = null;
      document.onmouseup = null;
      document.ontouchend = null;
      document.body.classList.remove("on-dragging");

      clearCollapseStatusOfAllSiblings(handler);
      calcCollapseStatusOfAllSiblings(handler);

      // Save panel size
      saveAllSiblingsSize(handler);
    };
    document.onmouseup = dragEnd;
    document.ontouchend = dragEnd;
    window.onfocus = dragEnd; // Reset while the window is switched back
    // -------------------- Drag end - END
  };

  handler.onmousedown = dragStart;
  handler.ontouchstart = dragStart;
  // -------------------- Drag start - END

  // -------------------- Collapse Previous - START
  const collapsePanel = (e): void => {
    debug("🎈🎈🎈🎈🎈", e, e.target.classList);
    e.stopPropagation();
    clearCollapseStatusOfAllSiblings(handler);
    // Get direction
    const target = e.target.classList.contains("prev") ? "prev" : "next";
    debug("target:", target);

    // Collapse or Expand
    const fullSize = end - start - props.size; // total avaliable size
    const storeKey = "beforeCollapse"; // store key of the size before collapse
    prevRect = prevEle?.getBoundingClientRect();
    nextRect = nextEle?.getBoundingClientRect();
    debug(`Size: Prev=${prevRect[dimension]} | Next=${nextRect[dimension]}`);
    if (prevRect[dimension] < 10 || nextRect[dimension] < 10) {
      debug("✅ Expand ->", target);
      // Load the size of the panel before collapsed
      const targetEle = target === "prev" ? nextEle : prevEle; // expand panel
      const anotherEle = target === "prev" ? prevEle : nextEle;
      // expand to prev
      const storedSize = loadSize(targetEle.id, storeKey)[dimension];
      debug("storedSize:", storedSize, "fullSize:", fullSize, targetEle.id);
      const minSize = Math.min(fullSize / 2, 200);
      const targetSize = Math.round(
        !storedSize || (storedSize && storedSize >= fullSize - 100) //store size invalid
          ? minSize // set as min size
          : Math.round(Math.max(storedSize, minSize))
      );
      debug(
        `Target(${target})=${targetSize} | another=${fullSize - targetSize}`
      );
      targetEle.style[dimension] = targetSize + "px";
      anotherEle.style[dimension] = fullSize - targetSize + "px";
    } else {
      // collapse
      debug(`✅ Collapse, total ${fullSize}`);
      // Store the size of expand status
      const targetEle = target === "prev" ? prevEle : nextEle;
      const targetSize = targetEle.getBoundingClientRect()[dimension];
      let sizeObj = {};
      sizeObj[dimension] = targetSize;
      saveSize(targetEle.id, sizeObj, storeKey);

      // Set the size of siblings
      prevEle.style[dimension] = `${target === "prev" ? 0 : fullSize}px`;
      nextEle.style[dimension] = `${target === "prev" ? fullSize : 0}px`;
      debug(
        `Collapse: ${prevEle.style[dimension]} | ${nextEle.style[dimension]}`
      );
    }

    // Add transition of neighbor
    prevEle.classList.add("transition-size");
    nextEle.classList.add("transition-size");
    setTimeout(() => {
      prevEle.classList.remove("transition-size");
      nextEle.classList.remove("transition-size");

      // Set the properties of handler
      handler.classList.add(`collapsed`);
      // Set the properties of siblings
      (target === "prev" ? prevEle : nextEle).classList.add(`panel-collapsed`);

      /**
       * If the :has selector is used, the previous configuration is sufficient.
       * Handler preceding the collapsed ele is .resize-handler:has(+ .collapsed)
       * However, to ensure compatibility with older browsers,
       * it's necessary to add a class to the elements preceding the handler.*/
      clearCollapseStatusOfAllSiblings(handler);
      calcCollapseStatusOfAllSiblings(handler);
      saveAllSiblingsSize(handler);
    }, 1000);
  };
  handler.querySelectorAll(".collapse-btn").forEach((btn) => {
    btn.addEventListener("click", collapsePanel);
    btn.addEventListener("touchstart", collapsePanel);
  });
  // -------------------- Collapse Previous - END

  console.groupEnd();
}

const getSiblings = (e: HTMLElement, includeHander = false): HTMLElement[] => {
  let siblingList: HTMLElement[] = [];
  e = e.parentElement?.firstElementChild as HTMLElement;
  // debug(`[Get siblingList] e:`, e);
  do {
    if (!includeHander && e.classList.contains("resize-handler")) continue;
    siblingList.push(e);
  } while ((e = e?.nextElementSibling as HTMLElement));
  debug("siblingList:", siblingList);
  return siblingList;
};

const saveAllSiblingsSize = (handler) => {
  const siblingList = getSiblings(handler);
  for (let ele of siblingList) {
    if (ele.id) {
      debug("ele.id:", ele.id, direction);
      let sizeInfo = {};
      sizeInfo[dimension] = ele.style[dimension];
      saveSize(ele.id, sizeInfo);
    }
  }
};

/**
 * ------------------------------ Write all siblings' size - START
 * Avoid flex getting wrong size due to other siblings
 * Flex automatically adjusts the size after it has been set, so setting the size one by one is not possible. For example, if the size of the first sibling is set to the current width, while the other siblings still have incorrect size properties, flex will calculate again and the size of the first sibling will change again. This process will continue for each sibling, resulting in incorrect sizes. After several iterations, the values will be very close to the correct sizes.
 */
const setAllSiblingsSize = (handler) => {
  const parentSize =
    handler.parentElement?.getBoundingClientRect()[dimension] || 0;
  let sizeList: any[] = [];
  let siblingsSizeTotal = 0;
  // Get size of all siblings
  getSiblings(handler).forEach((ele) => {
    if (ele.classList.contains("resize-handler")) return;
    const rect = ele.getBoundingClientRect();
    const size = rect[dimension] > 10 ? rect[dimension] : 0;
    sizeList.push({ ele: ele, size: size });
    siblingsSizeTotal += size; // fill parent container
    debug(`Set sibling [${ele.id}] ${dimension} = ${size}px`, ele, rect);
  });
  debug(`Sibling size total: ${siblingsSizeTotal} | ${parentSize}`);
  // Set size of all siblings
  const ratio = parentSize / siblingsSizeTotal;
  sizeList.forEach((item) => {
    item.ele.style[dimension] = item.size * ratio + "px";
  });
};

const calcCollapseStatusOfAllSiblings = (handler) => {
  const siblingList = getSiblings(handler, true);
  // debug("siblingList:", siblingList);
  for (let i = 0; i < siblingList.length; i++) {
    const ele = siblingList[i];
    const size = ele.getBoundingClientRect()[dimension];
    debug("size:", size, ele.id, i);
    if (size < 10) {
      debug("👻 Collapsed panel found:", ele);
      // Set very tiny panel to collapsed
      if (!ele.classList.contains("resize-handlar")) {
        ele.classList.add("panel-collapsed");
      }
      // Set property of prev handler
      if (i > 0 && siblingList[i - 1].classList.contains("resize-handler")) {
        siblingList[i - 1].classList.add("next-panel-collapsed");
        siblingList[i - 1].classList.add("collapsed");
      }
      // Set property of next handler
      if (
        i + 1 < siblingList.length &&
        siblingList[i + 1].classList.contains("resize-handler")
      ) {
        siblingList[i + 1].classList.add("prev-panel-collapsed");
        siblingList[i + 1].classList.add("collapsed");
      }
    }
  }
  setAllSiblingsSize(handler);
};

const clearCollapseStatusOfAllSiblings = (handler) => {
  // Add class is forEach, so clear class if for each too.
  getSiblings(handler, true).forEach((ele) => {
    debug("ele:", ele);
    ele.classList.remove(`collapsed`); // on handler
    ele.classList.remove(`prev-panel-collapsed`); // on handler
    ele.classList.remove(`next-panel-collapsed`); // on handler
    ele.classList.remove(`panel-collapsed`); //on panel
  });
};

const restorePanelSize = (handler) => {
  console.group("🍕载入面板尺寸");
  const storedObj = loadSize(); //node.id: { width: node.style.width }
  const siblingList = getSiblings(handler);
  for (let ele of siblingList) {
    debug("ele:", ele, ele.id);
    const styleDict = loadSize(ele.id);
    if (styleDict) {
      for (let styleName in styleDict) {
        ele.style[styleName] = styleDict[styleName];
      }
    }
  }

  calcCollapseStatusOfAllSiblings(handler);
  console.groupEnd();
};

onMounted(() => {
  debug("🎯🎯🎯", refHandler.value);
  // Add event/listener to handler
  initHandler(refHandler.value as HTMLElement);

  // Restore panel size
  restorePanelSize(refHandler.value);
});
// ------------------------------ drag - END
</script>

<style lang="scss">
:root {
  --fadein: cubic-bezier(0.25, 1, 0.75, 1.25);
  --fadeout: cubic-bezier(0.25, -0.25, 1, 1);
}

.resize-handler {
  --actual-size: var(--size); // Collapsed actual size
  flex: none !important;
  z-index: 99;
  box-sizing: border-box;
  background: var(--color);
  transition: width 0.2s, height 0.2s;

  // For child element
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;

  // Ensure hover elements on top
  &:hover {
    z-index: 999999;
  }

  // &::after = visible (normal status)
  // .hover-indicator (hover status)
  .hover-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--indicator-color);
    opacity: 0.5;
    transition: opacity 0.5s;

    &,
    &::after {
      width: 100%;
      height: 100%;
      position: absolute; // bigger size than parent
    }
    &::after {
      content: "";
      display: block;
      background: #0f09;
      transition: width 0.2s, height 0.2s;
    }
  }

  // show indicator
  &:hover .hover-indicator,
  &:active .hover-indicator,
  &:focus .hover-indicator {
    opacity: 1;
  }

  // Handler of LR
  &.LR {
    width: var(--size);
    cursor: ew-resize;
    flex-direction: row; // for prev/next align setting

    .hover-indicator {
      width: var(--indicator-size);

      &::after {
        width: var(--hover-size);
      }
    }
  }

  // Handler of TB
  &.TB {
    height: var(--size);
    cursor: ns-resize;
    flex-direction: column; // for prev/next align setting

    .hover-indicator {
      height: var(--indicator-size);

      &::after {
        height: var(--hover-size);
      }
    }
  }

  // Collapsed Panel
  &.collapsed {
    // Collaspsed min size
    --min-size: 4px;
    // Collapsed actual size
    --actual-size: max(var(--min-size), var(--size));

    &.LR {
      width: var(--actual-size);
    }
    &.TB {
      height: var(--actual-size);
    }

    &.prev-panel-collapsed {
      justify-content: flex-end;
    }
    &.next-panel-collapsed {
      justify-content: flex-start;
    }
  }

  // ------------------------------ Collapse Button - START
  // ::before = background
  // ::after = arrow
  .collapse-btn {
    --gap: 0.5rem; //between button and indicator
    --edge-l: 3rem;
    --edge-s: 1rem;
    --arrow: 0.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--gap);
    position: absolute;
    cursor: pointer;
    z-index: -1;
    // border: 1px solid red;
    opacity: 0;
    transform: scale(0);
    transition: opacity 0.3s, transform var(--fadeout) 0.3s;

    // before = background
    // after = arrow
    &::before,
    &::after {
      content: "";
      display: block;
    }

    &::before {
      // position: absolute;
      background: #fff;
      // border: 1px solid;
      border-radius: 0.5rem;
      box-shadow: 0 0 var(--gap) #0003;
      z-index: -1;
      box-sizing: border-box;
      transition: box-shadow 0.3s;
    }

    &::after {
      position: absolute;
      transition: color 0.3s;
    }

    &:hover {
      color: var(--indicator-color);
      &::before {
        box-shadow: 0 0 var(--gap) var(--indicator-color);
      }
    }
  }

  // When the handler is hovered over, the collapse button appears
  &:hover .collapse-btn {
    opacity: 1;
    transform: scale(1);
    // Transition delay, avoid the btn appearing while cursor is passing over
    transition: opacity 0.3s 0.5s, transform 0.3s var(--fadein) 0.5s;
  }
  // If the handler is already collapsed, there's no need for a delay
  &.collapsed:hover .collapse-btn {
    transition: opacity 0.3s, transform 0.3s var(--fadein);
  }

  &.LR .collapse-btn {
    top: calc(50% - var(--edge-l) / 2 - var(--gap));
    &::before {
      width: var(--edge-s);
      height: var(--edge-l);
    }
    &.prev {
      right: calc(var(--actual-size) + var(--hover-size) / 2);
      padding-right: var(--gap);
    }
    &.next {
      left: calc(var(--actual-size) + var(--hover-size) / 2);
      padding-left: var(--gap);
    }
    &::after {
      border-top: var(--arrow) solid transparent;
      border-bottom: var(--arrow) solid transparent;
    }
    &.prev::after {
      border-right: var(--arrow) solid;
    }
    &.next::after {
      border-left: var(--arrow) solid;
    }
  }
  &.TB .collapse-btn {
    left: calc(50% - var(--edge-l) / 2 - var(--gap));
    &::before {
      width: var(--edge-l);
      height: var(--edge-s);
    }
    &.prev {
      bottom: calc(var(--actual-size) + var(--hover-size) / 2);
      padding-bottom: var(--gap);
    }
    &.next {
      top: calc(var(--actual-size) + var(--hover-size) / 2);
      padding-top: var(--gap);
    }
    &::after {
      border-left: var(--arrow) solid transparent;
      border-right: var(--arrow) solid transparent;
    }
    &.prev::after {
      border-bottom: var(--arrow) solid;
    }
    &.next::after {
      border-top: var(--arrow) solid;
    }
  }
  // ------------------------------ Collapse Button - END
}

// The handlar after the collapsed element
.panel-collapsed + .resize-handler,
.resize-handler.prev-panel-collapsed {
  .collapse-btn.prev {
    display: none;
  }
}
// The handler before the collapsed element
.resize-handler:has(+ .panel-collapsed),
.resize-handler.next-panel-collapsed {
  .collapse-btn.next {
    display: none;
  }
}
// The hanlder of sub-panel, which parent panel is collapsed.
.panel-collapsed .resize-handler {
  display: none;
}

// While dragging, prevent text be selected.
.on-dragging {
  &,
  & * {
    // pointer-events: none;
    user-select: none;
    // color: red;
  }
}

.transition-size {
  transition: width var(--fadein) 0.5s, height var(--fadein) 0.5s !important;
}
</style>
