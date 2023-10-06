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
  >
    <!-- display while mouse hove -->
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
    size: 0,
    hoverSize: 10,
    color: "#333",
    indicatorSize: 2,
    indicatorColor: "#06f",
  }
);

const debug = (...args) => {
  // return;
  console.debug("[📏]", ...args);
};

// ------------------------------ store size - START
const lsKey = "panelSize"; // local storage key of panel size
const loadSize = (panelId: string | null = null): Object => {
  const storedObj = JSON.parse(localStorage.getItem(lsKey) || "{}");
  return panelId ? storedObj[panelId] || {} : storedObj;
};
const saveSize = (panelId: string, sizeObj: Object): void => {
  const storedObj = loadSize();
  storedObj[panelId] = sizeObj;
  localStorage.setItem(lsKey, JSON.stringify(storedObj));
};
// ------------------------------ store size - END

// ------------------------------ drag - START
// 拖动对象边缘改变其大小
// TODO: 直接在JS内创建拖动把手 把方法直接添加到element上
function dragResize(
  handler: HTMLElement, // element
  collapseThreshold: number = 100 // if panel size less than this value, panel collapse
): void {
  console.group("drag event init");

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
  let direction;
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
  debug("handlerDirection:", direction, prevRect, nextRect);

  // -------------------- Drag start - START
  const dragStart = () => {
    debug("Drag Start");
    clearCollapseProperties();

    const halfSize = props.size / 2;
    debug("halfSize:", halfSize);

    // Prevent text be selected while mouse move
    document.body.classList.add("on-dragging");

    /**
     * ------------------------------ Write all siblings' size - START
     * Avoid flex getting wrong size due to other siblings
     * Flex automatically adjusts the size after it has been set, so setting the size one by one is not possible. For example, if the size of the first sibling is set to the current width, while the other siblings still have incorrect size properties, flex will calculate again and the size of the first sibling will change again. This process will continue for each sibling, resulting in incorrect sizes. After several iterations, the values will be very close to the correct sizes.
     */
    const setAllSiblingSize = () => {
      const getSiblings = (e: HTMLElement): HTMLElement[] => {
        let siblings: HTMLElement[] = [];
        e = e.parentElement?.firstElementChild as HTMLElement;
        do {
          if (e.classList.contains("resize-handler")) continue;
          siblings.push(e);
        } while ((e = e.nextElementSibling as HTMLElement));
        return siblings;
      };
      const attr = direction === "LR" ? "width" : "height";
      const parentSize =
        handler.parentElement?.getBoundingClientRect()[attr] || 0;
      let sizeList: any[] = [];
      let siblingsSizeTotal = 0;
      // Get size of all siblings
      getSiblings(handler).forEach((ele) => {
        const rect = ele.getBoundingClientRect();
        sizeList.push({ ele: ele, size: rect[attr] });
        siblingsSizeTotal += rect[attr]; // fill parent container
        debug(`Set sibling [${ele.id}] ${attr} = ${rect[attr]}px`, ele, rect);
      });
      debug(`Sibling size total: ${siblingsSizeTotal} | ${parentSize}`);
      // Set size of all siblings
      const ratio = parentSize / siblingsSizeTotal;
      sizeList.forEach((item) => {
        item.ele.style[attr] = item.size * ratio + "px";
      });
    };
    setAllSiblingSize();
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
      let prevSize = prevRect.width;
      let nextSize = nextRect.width;
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
      const attr = direction === "LR" ? "width" : "height";
      prevEle.style[attr] = `${prevSize}px`;
      nextEle.style[attr] = `${nextSize}px`;
      debug(
        `Range:${parseInt(start)}-${parseInt(end)} | Current:${parseInt(
          current
        )} | ${parseInt(prevSize)} + ${parseInt(nextSize)} = ${parseInt(
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

      // Save panel size
      for (let node of [prevEle, nextEle]) {
        debug("end - node:", node);
        if (node.id) {
          debug("end - node.id:", node.id, direction);
          if (direction === "LR") {
            saveSize(node.id, { width: node.style.width });
          } else if (direction === "TB") {
            saveSize(node.id, { height: node.style.height });
          }
        }
      }
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
    clearCollapseProperties();
    // Get direction
    const target = e.target.classList.contains("prev") ? "prev" : "next";
    debug("target:", target);

    // Store the size of expand status

    // Set the size of siblings
    const fullSize = end - start - props.size;
    const attr = direction === "LR" ? "width" : "height";
    prevEle.style[attr] = `${target === "prev" ? 0 : fullSize}px`;
    nextEle.style[attr] = `${target === "prev" ? fullSize : 0}px`;

    // Add transition of neighbor
    prevEle.classList.add("transition-size");
    nextEle.classList.add("transition-size");
    setTimeout(() => {
      prevEle.classList.remove("transition-size");
      nextEle.classList.remove("transition-size");
    }, 1000);

    // Set the properties of handler
    handler.classList.add(`collapsed`);
    (target === "prev" ? prevEle : nextEle).classList.add(`collapsed`);
  };
  handler.querySelectorAll(".collapse-btn").forEach((btn) => {
    btn.addEventListener("click", collapsePanel);
    btn.addEventListener("touchstart", collapsePanel);
  });

  const clearCollapseProperties = () => {
    handler.classList.remove(`collapsed`);
    prevEle.classList.remove(`collapsed`);
    nextEle.classList.remove(`collapsed`);
  };
  // -------------------- Collapse Previous - END

  console.groupEnd();
}

const restorePanelSize = () => {
  console.group("🍕载入面板尺寸");
  const storedObj = loadSize();
  for (let nodeId in storedObj) {
    debug("nodeId:", nodeId);
    const styleDict = storedObj[nodeId];
    const node = document.querySelector("#" + nodeId) as HTMLElement;
    if (node) {
      for (let styleName in styleDict) {
        node.style[styleName] = styleDict[styleName];
      }
    }
  }
  console.groupEnd();
};

onMounted(() => {
  // Add event/listener to handler
  document
    .querySelectorAll(".resize-handler")
    .forEach((ele) => dragResize(ele as HTMLElement));

  // Restore panel size
  restorePanelSize();
});
// ------------------------------ drag - END
</script>

<style lang="scss">
.resize-handler {
  // background: #0b08;
  flex: none !important;
  position: relative;
  z-index: 99;
  --actual-size: var(--size);

  // &::after = visible (normal status)
  // .hover-indicator (hover status)
  &::after,
  .hover-indicator {
    content: "";
    display: block;
    width: 100%;
    height: 100%;
  }
  &::after {
    background: var(--color);
  }
  &:hover {
    z-index: 99999;
  }

  // indicator line
  .hover-indicator {
    position: absolute;
    background: var(--indicator-color);
    opacity: 0;
    transition: 0.5s opacity;
  }
  &:hover .hover-indicator,
  &:active .hover-indicator {
    opacity: 1;
  }

  // Handler of LR
  &.LR {
    padding: 0 calc(var(--hover-size) * 0.5);
    margin: 0 calc(var(--hover-size) * -0.5);
    top: 0;
    right: 0;
    cursor: ew-resize;
    &::after {
      width: var(--size);
    }
    .hover-indicator {
      width: var(--indicator-size);
      left: calc(50% - var(--indicator-size) / 2);
    }
  }

  // Handler of TB
  &.TB {
    padding: calc(var(--hover-size) * 0.5) 0;
    margin: calc(var(--hover-size) * -0.5) 0;
    left: 0;
    bottom: 0;
    cursor: ns-resize;
    &::after {
      height: var(--size);
    }
    .hover-indicator {
      height: var(--indicator-size);
      top: calc(50% - var(--indicator-size) / 2);
    }
  }

  // Collapsed
  &.collapsed {
    // Collaspsed min size
    --min-size: 4px;
    // Collapsed actual size
    --actual-size: max(var(--min-size), var(--size));
    .hover-indicator {
      margin: 0;
    }

    &.LR {
      &::after {
        width: var(--actual-size);
      }
      &.prev-collapsed {
        .hover-indicator {
          right: 0;
        }
      }
      &.next-collapsed {
        .hover-indicator {
          left: 0;
        }
      }
    }
    &.TB {
      &::after {
        height: var(--actual-size);
      }
      &.prev-collapsed {
        .hover-indicator {
          bottom: 0;
        }
      }
      &.next-collapsed {
        .hover-indicator {
          top: 0;
        }
      }
    }
  }

  // ------------------------------ Collapse Button - START
  // ::before = background
  // ::after = arrow
  .collapse-btn {
    --gap: 0.25rem; //between button and indicator
    --edge-l: 3rem;
    --edge-s: 1rem;
    --arrow: 0.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    // border: 1px solid red;
    padding: var(--gap);
    position: absolute;
    cursor: pointer;
    opacity: 0.2;

    &::before,
    &::after {
      content: "";
      display: block;
    }

    &::before {
      // position: absolute;
      background: #fff;
      border: 1px solid;
      border-radius: 0.5rem;
      z-index: -1;
      box-sizing: border-box;
    }

    &::after {
      position: absolute;
    }

    &:hover {
      color: var(--indicator-color);
    }
  }
  &:hover .collapse-btn {
    opacity: 1;
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

.collapsed + .resize-handler .collapse-btn.prev,
.resize-handler:has(.collapsed) .collapse-btn.next {
  display: none;
}
.collapsed .resize-handler {
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
  transition: width 1s, height 1s !important;
}
</style>
