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
      indicatorColor +
      ';--collapsed-min-size:' +
      collapsedMinSize +
      'px;--collapsed-bg:' +
      collapsedBg
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
    size?: number; // The width/height of handler
    hoverSize?: number; // Additional size for hover, invisible, take max val
    color?: string; // The color of handler

    // hover indicator
    indicatorSize?: number; // The width/height of indicator
    indicatorColor?: string; // The color of indicator

    // collapsed handler
    collapsedMinSize?: number; // While collapsed, set a min size to indentify
    collapsedBg?: string; // bg of collapsed hander, border is handler color
  }>(),
  {
    prevMinSize: 200,
    nextMinSize: 200,
    size: 1,
    hoverSize: 10,
    color: "#333",
    indicatorSize: 2,
    indicatorColor: "#06f",
    collapsedMinSize: 4,
    collapsedBg: "#fff",
  }
);

const debug = (...args) => {
  // return;
  console.debug("[📏]", ...args);
};

const refHandler = ref(); // Element
let direction: "LR" | "TB"; // LR or TB
let dimension: "width" | "height"; // width or height

// ------------------------------ store size - START
const lsKey = "panelSize"; // local storage key of panel size
type SizeObj = {
  width?: number;
  height?: number;
};

const loadSize = (
  panelId: string | null = null, //panel id
  key: string = lsKey //store name
): SizeObj => {
  const storedObj = JSON.parse(localStorage.getItem(key) || "{}");
  const result = panelId ? storedObj[panelId] || {} : storedObj;
  // debug("Load: panelId=", panelId, "key=", key, "result=", result);
  return result;
};

const saveSize = (
  panelId: string, //panel id
  sizeObj: SizeObj, //size dictionary
  key: string = lsKey //store name
): void => {
  // debug("Save: panelId=", panelId, "sizeObj=", sizeObj, "key=", key);
  const storedObj = loadSize(null, key);
  storedObj[panelId] = sizeObj;
  localStorage.setItem(key, JSON.stringify(storedObj));
};
// ------------------------------ store size - END

// ------------------------------ drag - START
function initHandler(
  handler: HTMLElement, // element
  collapseThreshold: number = 100 // collapse if panel size less than this value
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

  // Calculate the valid range while dragging
  const clamp = (v: number): number =>
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

  // Check neighbors' id
  if (!prevEle.id || !nextEle.id) {
    console.warn("The neighbors of handler must have ID", prevEle, nextEle);
  }

  // -------------------- Drag start - START
  const dragStart = () => {
    debug("Drag Start");

    const halfSize = props.size / 2;
    // debug("halfSize:", halfSize);

    // Prevent text be selected while mouse move
    document.body.classList.add("on-dragging");

    setActualSizeOfSiblings(handler);

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
      debug("e.type:", e.type);
      const src = e.type === "mousemove" ? e : e.touches[0];
      const current = direction === "LR" ? src.clientX : src.clientY;
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
      calcCollapseStatusOfSiblings(handler);

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
  const collapsePanel = (e: Event): void => {
    const targetEle = e.target as Element;
    debug("🎈🎈🎈🎈🎈", e, targetEle.classList);
    e.stopPropagation();
    clearCollapseStatusOfAllSiblings(handler);
    // Get direction
    const target = targetEle.classList.contains("prev") ? "prev" : "next";
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
      handler.classList.add("collapsed");
      // Set the properties of siblings
      (target === "prev" ? prevEle : nextEle).classList.add(`panel-collapsed`);

      /**
       * If the :has selector is used, the previous configuration is sufficient.
       * Handler preceding the collapsed ele is .resize-handler:has(+ .collapsed)
       * However, to ensure compatibility with older browsers,
       * it's necessary to add a class to the elements preceding the handler.*/
      clearCollapseStatusOfAllSiblings(handler);
      calcCollapseStatusOfSiblings(handler);
      saveAllSiblingsSize(handler);
    }, 1000);
  };
  handler.querySelectorAll(".collapse-btn").forEach((btn) => {
    btn.addEventListener("click", collapsePanel);
  });
  // -------------------- Collapse Previous - END

  console.groupEnd();
}

// ------------------------------ Get all siblings - START
const getSiblings = (e: HTMLElement, includeHander = false): HTMLElement[] => {
  let siblingList: HTMLElement[] = [];
  e = e.parentElement?.firstElementChild as HTMLElement;
  do {
    if (!includeHander && e?.classList.contains("resize-handler")) continue;
    if (e !== undefined) {
      siblingList.push(e);
    }
  } while ((e = e?.nextElementSibling as HTMLElement));
  debug(`👬🏻 siblingList(${includeHander}):`, siblingList);
  return siblingList;
};
// ------------------------------ Get all siblings - END

/**
 * ------------------------------ Write all siblings' size - START
 * Avoid flex getting wrong size due to other siblings
 * Flex automatically adjusts the size after it has been set, so setting the size one by one is not possible. For example, if the size of the first sibling is set to the current width, while the other siblings still have incorrect size properties, flex will calculate again and the size of the first sibling will change again. This process will continue for each sibling, resulting in incorrect sizes. After several iterations, the values will be very close to the correct sizes.
 * Another problem is that the handler may have a different size than props.size due to flex properties. To resolve this, we need to set the handler size to a preset value and adjust the panel size based on the remaining space.
 */
const setActualSizeOfSiblings = (handler: HTMLElement) => {
  let parentSize =
    handler.parentElement?.getBoundingClientRect()[dimension] || 0;
  let sizeList: { ele: HTMLElement; size: number }[] = [];
  let siblingsSizeTotal = 0;
  // Get size of all siblings
  getSiblings(handler, true).forEach((ele) => {
    // Minus handler size (without flex)
    if (ele.classList.contains("resize-handler")) {
      const size = ele.classList.contains("collapsed")
        ? props.collapsedMinSize
        : props.size;
      parentSize -= size;
      return;
    }
    const rect = ele.getBoundingClientRect();
    const size = rect[dimension] <= 10 ? 0 : rect[dimension]; // collapse tiny
    sizeList.push({ ele: ele, size: size });
    siblingsSizeTotal += size; // fill parent container
    debug(`Set sibling [${ele.id}] ${dimension} = ${size}px`, ele, rect);
  });
  debug(`Sibling size total: ${siblingsSizeTotal} | ${parentSize}`);

  /**
   * Set size of all siblings
   * Calculate  */

  const ratio = parentSize / siblingsSizeTotal;
  for (let i = 0; i < sizeList.length; i++) {
    const item = sizeList[i];
    let size = 0;
    if (i < sizeList.length - 1) {
      size = Math.round(item.size * ratio);
      parentSize -= size;
    } else {
      size = parentSize; // The final panel uses all the remaining space
    }
    item.ele.style[dimension] = size + "px";
  }
};
// ------------------------------ Write all siblings' size - END

// ------------------------------ Modify siblings' collapsed status - START
const calcCollapseStatusOfSiblings = (handler: HTMLElement) => {
  const siblingList = getSiblings(handler, true);
  // debug("siblingList:", siblingList);
  for (let i = 0; i < siblingList.length; i++) {
    const ele = siblingList[i];
    if (ele.classList.contains("resize-handlar")) continue; //watch panels only
    const size = ele.getBoundingClientRect()[dimension];
    // debug("size:", size, ele.id, i);
    if (size <= 10) {
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
  setActualSizeOfSiblings(handler);
};

const clearCollapseStatusOfAllSiblings = (handler: HTMLElement) => {
  // Add class is forEach, so clear class if for each too.
  getSiblings(handler, true).forEach((ele) => {
    if (ele) {
      ele.classList.remove("collapsed"); // on handler
      ele.classList.remove("prev-panel-collapsed"); // on handler
      ele.classList.remove("next-panel-collapsed"); // on handler
      ele.classList.remove("panel-collapsed"); //on panel
    }
  });
};
// ------------------------------ Modify siblings' collapsed status - END

// ------------------------------ Store & Restore Panel Size - START
const saveAllSiblingsSize = (handler: HTMLElement): void => {
  console.group("💾 Save All Siblings' Size");
  const siblingList = getSiblings(handler);
  for (let ele of siblingList) {
    if (ele.id) {
      let sizeInfo: SizeObj = {
        [dimension]: ele.getBoundingClientRect()[dimension],
      };
      saveSize(ele.id, sizeInfo);
      // debug(`Save Size: ele.id=${ele.id}`, sizeInfo);
    }
  }
  debug(loadSize());
  console.groupEnd();
};

const restorePanelSize = (handler: HTMLElement) => {
  console.group("🍕 Restore panel size");
  const siblingList = getSiblings(handler);
  for (let ele of siblingList) {
    debug("ele:", ele, ele.id);
    const styleDict = loadSize(ele.id);
    if (styleDict) {
      for (let styleName in styleDict) {
        ele.style[styleName] = styleDict[styleName] + "px";
      }
    }
  }

  calcCollapseStatusOfSiblings(handler);
  console.groupEnd();
};
// ------------------------------ Store & Restore Panel Size - END

onMounted(() => {
  debug("🎯🎯🎯 Mounted", refHandler.value);

  // Add event/listener to handler
  initHandler(refHandler.value);

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
  // active = ondrag, but not hover
  &:hover,
  &:active,
  &:focus {
    z-index: 999999;
    .hover-indicator {
      opacity: 1;
    }
  }

  // &::after = visible (normal status)
  // .hover-indicator (hover status)
  .hover-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--indicator-color);
    // opacity: 0.1; // debug
    opacity: 0;
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
      // background: #0f09;
      transition: width 0.2s, height 0.2s;
      z-index: -1;
    }
  }

  // Handler of LR
  &.LR {
    width: var(--size);
    cursor: ew-resize;
    flex-direction: row; // for prev/next align setting

    .hover-indicator {
      width: var(--indicator-size);

      &::after {
        width: max(var(--size), var(--hover-size));
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
        height: max(var(--size), var(--hover-size));
      }
    }
  }

  // Collapsed
  &.collapsed {
    // Collapsed actual size (avoid too thin, easily identifiable)
    --actual-size: max(var(--collapsed-min-size), var(--size));
    background: var(--collapsed-bg);

    &.LR {
      width: var(--actual-size);
      .hover-indicator::after {
        width: max(var(--indicator-size), var(--hover-size));
      }
      &.prev-panel-collapsed {
        border-right: 1px solid var(--color);
      }
      &.next-panel-collapsed {
        border-left: 1px solid var(--color);
      }
    }
    &.TB {
      height: var(--actual-size);
      .hover-indicator::after {
        height: max(var(--indicator-size), var(--hover-size));
      }
      &.prev-panel-collapsed {
        border-bottom: 1px solid var(--color);
      }
      &.next-panel-collapsed {
        border-top: 1px solid var(--color);
      }
    }

    // Change the indicator position while collapsed
    &.prev-panel-collapsed {
      justify-content: flex-end;
    }
    &.next-panel-collapsed {
      justify-content: flex-start;
    }
    &.collapsed .hover-indicator {
      margin: calc(var(--indicator-size) / -2);
    }

    // If both neighbors all collapsed, prevent drag
    &.prev-panel-collapsed.next-panel-collapsed {
      pointer-events: none;
      user-select: none;
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
    // border: 1px solid red; //debug
    // opacity: 0.5; //debug
    opacity: 0; //product
    transform: scale(0); //product
    transition: opacity 0.3s, transform var(--fadeout) 0.3s;

    // before = background, after = arrow
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

  // Maintain a small size while collapsed for easy activation.
  &.collapsed .collapse-btn {
    transform: scale(0.5);
  }

  // When the handler is hovered over, the collapse button appears
  &:hover .collapse-btn {
    opacity: 1;
    transform: scale(1);
    // Transition delay, avoid the btn appearing while cursor is passing over
    transition: opacity 0.2s 0.3s, transform 0.2s var(--fadein) 0.3s;
  }
  // If the handler is already collapsed, there's no need for a delay
  &.collapsed:hover .collapse-btn {
    transition: opacity 0.3s, transform 0.3s var(--fadein);
  }

  &.LR .collapse-btn {
    top: calc(50% - var(--edge-l) / 2 - var(--gap));
    // before = background, after = arrow
    &::before {
      width: var(--edge-s);
      height: var(--edge-l);
    }
    &::after {
      border-top: var(--arrow) solid transparent;
      border-bottom: var(--arrow) solid transparent;
    }
    &.prev {
      right: var(--actual-size);
      transform-origin: right;
      &::after {
        border-right: var(--arrow) solid;
      }
    }
    &.next {
      left: var(--actual-size);
      transform-origin: left;
      &::after {
        border-left: var(--arrow) solid;
      }
    }
  }
  &.TB .collapse-btn {
    left: calc(50% - var(--edge-l) / 2 - var(--gap));
    &::before {
      width: var(--edge-l);
      height: var(--edge-s);
    }
    &::after {
      border-left: var(--arrow) solid transparent;
      border-right: var(--arrow) solid transparent;
    }
    &.prev {
      bottom: var(--actual-size);
      transform-origin: bottom;
      &::after {
        border-bottom: var(--arrow) solid;
      }
    }
    &.next {
      top: var(--actual-size);
      transform-origin: top;
      &::after {
        border-top: var(--arrow) solid;
      }
    }
  }
  // ------------------------------ Collapse Button - END
}

// Collapse panel
// Prevent size change while window size expand
.panel-collapsed {
  flex: none !important;
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

// While dragging, prevent text be selected. Added to body.
.on-dragging {
  &,
  & * {
    // pointer-events: none;
    user-select: none;
  }
}

// Apply animation to the panel while collapsing and expanding.
.transition-size {
  transition: width var(--fadein) 0.5s, height var(--fadein) 0.5s !important;
}
</style>
