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
    <div class="hover-indicator">
      <!-- the collapse buttons -->
      <div
        class="collapse-btn prev"
        :class="{ 'non-collapsible': !prevCollapsible }"
      />
      <div
        class="collapse-btn next"
        :class="{ 'non-collapsible': !nextCollapsible }"
      />

      <!-- info -->
      <div class="panel-info prev"></div>
      <div class="panel-info next"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
const props = withDefaults(
  defineProps<{
    // normal status
    size?: number; // The width/height of handler
    hoverSize?: number; // Additional size for hover, invisible, take max val
    color?: string; // The color of handler

    // hover indicator
    indicatorSize?: number; // The width/height of indicator
    indicatorColor?: string; // The color of indicator

    // collapsed handler
    collapseThreshold?: number; // Panel collapse when smaller than this size

    // adjacent elements
    collapsedSize?: number; // While collapsed, set a min size to indentify
    collapsedBg?: string; // BG of collapsed hander, border is handler color

    prevCollapsible?: boolean;
    nextCollapsible?: boolean;

    /** Resize Adjacent Element Only
     * The main difference is about the size limit panel
     * e.g. start=100, left panel w=200, right panel w/min-w=200, end=500
     * If true, the other panels will be frozen. The handler for moving right may appear to not work because it reaches the min-width of the right panel.
     * If false, the other panels can be resized. For instance, moving the handler from 300 to 400 will cause the left panel to expand. However, due to flex, the width may not be exact.*/
    freezeOtherPanel?: boolean;
  }>(),
  {
    size: 10,
    hoverSize: 10,
    color: "#333",
    indicatorSize: 2,
    indicatorColor: "#06f",
    collapseThreshold: 100,
    collapsedSize: 10,
    collapsedBg: "#f00",
    prevCollapsible: true,
    nextCollapsible: true,
    freezeOtherPanel: false,
  }
);

const refHandler = ref(); // Element
let direction: "LR" | "TB"; // LR or TB
let dimension: "width" | "height"; // width or height
let prevCollapsedSize: number;
let nextCollapsedSize: number;
let prevMinSize: number;
let nextMinSize: number;

// ------------------------------ store size - START
const lsKey = "panelSize"; // local storage key of panel size
const lsBeforeCollapseKey = "beforeCollapse"; // store key of the size before collapse

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
  // console.debug("Load: panelId=", panelId, "key=", key, "result=", result);
  return result;
};

const saveSize = (
  panelId: string, //panel id
  sizeObj: SizeObj, //size dictionary
  key: string = lsKey //store name
): void => {
  // console.debug("Save: panelId=", panelId, "sizeObj=", sizeObj, "key=", key);
  const storedObj = loadSize(null, key);
  storedObj[panelId] = sizeObj;
  localStorage.setItem(key, JSON.stringify(storedObj));
};
// ------------------------------ store size - END

// ------------------------------ drag - START
const initHandler = (
  handler: HTMLElement // element
): void => {
  console.group("Init handler", handler);

  // Add style to parent
  let parentEle = handler.parentElement;
  parentEle?.classList.add("handler-wrapper");

  // Define adjacents
  let prevEle = handler.previousElementSibling as HTMLElement;
  let nextEle = handler.nextElementSibling as HTMLElement;
  let prevRect = prevEle?.getBoundingClientRect(); // for calc direction
  let nextRect = nextEle?.getBoundingClientRect(); // for calc direction
  console.debug("[0]Prev Node:", prevEle, prevRect);
  console.debug("[0]Next Node:", nextEle, nextRect);
  if (!(prevEle && nextEle)) return; // Do not resize without siblings

  // Check if element is handler
  const isHandler = (ele: HTMLElement): boolean =>
    ele && ele.classList.contains("resize-handler"); //ele might be null

  // Get handler of adjacents
  let prevPrev = prevEle.previousElementSibling as HTMLElement;
  let prevHdl = isHandler(prevPrev) ? prevPrev : undefined;
  let nextNext = nextEle.nextElementSibling as HTMLElement;
  let nextHdl = isHandler(nextNext) ? nextNext : undefined;
  console.debug("[0]Prev Handler:", prevHdl);
  console.debug("[0]Next Handler:", nextHdl);

  // init info box
  let prevInfo = handler.querySelector(".panel-info.prev") as HTMLElement;
  let nextInfo = handler.querySelector(".panel-info.next") as HTMLElement;

  // Define vaiables and common functions
  let start = 0; // Previous node top/left
  let end = window.innerWidth; // Next node bottom/right

  // Determine the handler direction by adjacents
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
  console.debug("handlerDirection:", direction, dimension, prevRect, nextRect);

  // Check neighbors' id
  if (!prevEle.id || !nextEle.id) {
    console.warn("The neighbors of handler must have ID", prevEle, nextEle);
  }

  // ------------------------------ Get all siblings - START
  const getSiblings = (): HTMLElement[] => {
    let siblingList: HTMLElement[] = [];
    if (!handler.parentElement) return siblingList;

    let element = handler.parentElement?.firstElementChild as HTMLElement;
    do {
      siblingList.push(element);
    } while ((element = element?.nextElementSibling as HTMLElement));

    // console.debug(`👬🏻 siblingList:`, siblingList);
    return siblingList;
  };
  // ------------------------------ Get all siblings - END

  // ------------------------------ Create collapsed panel's view - START
  // panel-collapsed-view is a special div only display when panel is collapsed
  getSiblings().forEach((ele) => {
    if (isHandler(ele)) return; //skip handler
    if (ele.querySelector(".panel-collapsed-view")) return; // skip view existed
    // Create div
    let collapsedPanelView = document.createElement("div");
    collapsedPanelView.classList.add("panel-collapsed-view");
    ele.appendChild(collapsedPanelView);
  });
  // ------------------------------ Create collapsed panel's view - END

  // ------------------------------ Update size of adjacent elements - START
  const updatePanelRectSize = () => {
    prevRect = prevEle.getBoundingClientRect();
    nextRect = nextEle.getBoundingClientRect();
    if (direction === "LR") {
      start = prevRect.x;
      end = nextRect.x + nextRect.width;
    } else if (direction === "TB") {
      start = prevRect.y;
      end = nextRect.y + nextRect.height;
    }

    const prevPropCollapsedSize = prevEle.getAttribute("data-collapsed-size");
    prevCollapsedSize = prevPropCollapsedSize
      ? parseInt(prevPropCollapsedSize)
      : 0;
    const nextPropCollapsedSize = nextEle.getAttribute("data-collapsed-size");
    nextCollapsedSize = nextPropCollapsedSize
      ? parseInt(nextPropCollapsedSize)
      : 0;
    console.debug(
      "prevCollapsedSize:",
      prevCollapsedSize,
      "nextCollapsedSize:",
      nextCollapsedSize
    );

    const prevPropMinSize = prevEle.getAttribute("data-min-size");
    prevMinSize = prevPropMinSize ? parseInt(prevPropMinSize) : 0;
    const nextPropMinSize = nextEle.getAttribute("data-min-size");
    nextMinSize = nextPropMinSize ? parseInt(nextPropMinSize) : 0;
    // const attribute = dimension === "width" ? "minWidth" : "minHeight";
    // prevEle.style[attribute] = `${prevMinSize}px`;
    // nextEle.style[attribute] = `${nextMinSize}px`;
  };
  updatePanelRectSize();
  // ------------------------------ Update size of adjacent elements - END

  // ------------------------------ Update info content - START
  const updateInfo = () => {
    prevRect = prevEle.getBoundingClientRect();
    nextRect = nextEle.getBoundingClientRect();
    prevInfo.textContent = `${Math.round(prevRect[dimension] * 100) / 100}`;
    nextInfo.textContent = `${Math.round(nextRect[dimension] * 100) / 100}`;
  };
  // ------------------------------ Update info content - END

  // ------------------------------ Collapse & Expand Panel - START
  const clearCollapsePropertiesOfAdjacent = () => {
    prevHdl?.classList.remove("next-panel-collapsed");
    prevEle.classList.remove("panel-collapsed");
    handler.classList.remove("prev-panel-collapsed");
    handler.classList.remove("next-panel-collapsed");
    nextEle.classList.remove("panel-collapsed");
    nextHdl?.classList.remove("prev-panel-collapsed");
  };

  /**
   * Simplify the calculation and ignore the size change of handler
   * Lock the sizes of the other panels and allow resizing only for the adjacent
   */
  const freezeNonAdjacentElements = (cmd: "freeze" | "unfreeze"): void => {
    getSiblings().forEach((ele) => {
      if ([prevHdl, prevEle, handler, nextEle, nextHdl].includes(ele)) return;
      if (cmd === "freeze") {
        ele.classList.add("freeze");
      } else {
        ele.classList.remove("freeze");
      }
    });
  };

  const addPanelTransition = (className: string, duration: number = 200) => {
    prevEle.classList.add(className);
    nextEle.classList.add(className);
    setTimeout(() => {
      prevEle.classList.remove(className);
      nextEle.classList.remove(className);
    }, duration);
  };

  const collapsePanel = (collapseDirection: "prev" | "next") => {
    const targetEle = collapseDirection === "prev" ? prevEle : nextEle;
    const anotherEle = collapseDirection === "next" ? prevEle : nextEle;
    const targetHdl = collapseDirection === "prev" ? prevHdl : nextHdl;
    const targetMinSize =
      collapseDirection === "prev" ? prevCollapsedSize : nextCollapsedSize;
    let hdlChange = 0;
    if (!targetHdl) {
      hdlChange = 0; // on window edge, no handler
    } else if (
      targetHdl?.classList.contains(`${collapseDirection}-panel-collapsed`)
    ) {
      hdlChange = props.size; // Target handler already collapsed
    } else {
      hdlChange = props.collapsedSize; // Target handler is not collapsed
    }
    const oppositeDirection = collapseDirection === "prev" ? "next" : "prev";
    const fullSize = end - start - props.collapsedSize - hdlChange;
    const targetSize = targetMinSize;
    const anotherSize = fullSize - targetSize;
    targetEle.style[dimension] = `${targetSize}px`;
    anotherEle.style[dimension] = `${anotherSize}px`;
    console.debug(
      `hdlChange:${hdlChange} ` +
        `start:${start} end:${end} end-start:${end - start} ` +
        `full:${fullSize} target:${targetSize} another:${anotherSize}`
    );

    // Change styles (if panel has min-size, panel won't be collapsed)
    handler.classList.add(`${collapseDirection}-panel-collapsed`);
    targetEle.classList.add("panel-collapsed");
    targetHdl?.classList.add(`${oppositeDirection}-panel-collapsed`);

    addPanelTransition("drag-transition", 200);

    return {
      prevSize: collapseDirection === "prev" ? targetSize : anotherSize,
      nextSize: collapseDirection === "next" ? targetSize : anotherSize,
    };
  };

  const expandPanel = (collapseDirection: "prev" | "next"): void => {
    // Load the size of the panel before collapsed
    const targetEle = collapseDirection === "prev" ? nextEle : prevEle;
    const anotherEle = collapseDirection === "next" ? nextEle : prevEle;
    const targetHdl = collapseDirection === "prev" ? nextHdl : prevHdl;
    const oppositeDirection = collapseDirection === "prev" ? "next" : "prev";
    let hdlChange = 0;
    if (!targetHdl) {
      hdlChange = 0; // on window edge, no handler
    } else if (
      targetHdl?.classList.contains(`${oppositeDirection}-panel-collapsed`)
    ) {
      hdlChange = props.size; // Target handler already collapsed
    } else {
      hdlChange = props.collapsedSize; // Target handler is not collapsed
    }
    const fullSize = end - start - props.size + hdlChange; // handler changes

    // Read stored size
    const storedSize = loadSize(targetEle.id, lsBeforeCollapseKey)[dimension];
    const minSize = Math.min(fullSize / 2, props.collapseThreshold);
    const targetSize = Math.round(
      !storedSize || // no stored size
        (storedSize && storedSize >= fullSize - props.collapseThreshold) // invalid
        ? minSize // set as min size
        : Math.round(Math.max(storedSize, minSize))
    );
    targetEle.style[dimension] = targetSize + "px";
    anotherEle.style[dimension] = fullSize - targetSize + "px";
    console.debug(
      `storedSize:${storedSize} hdlChange:${hdlChange} ` +
        `start:${start} end:${end} end-start:${end - start} ` +
        `full:${fullSize} target:${targetSize} another:${fullSize - targetSize}`
    );

    addPanelTransition("drag-transition", 200);

    // remove collapsed classes
    clearCollapsePropertiesOfAdjacent();
  };
  // ------------------------------ Collapse & Expand Panel - END

  // -------------------- Drag start - START
  const dragStart = () => {
    console.debug("🚩 Drag Start");

    const halfSize = props.size / 2;

    // Prevent text be selected while mouse move
    document.body.classList.add("body-on-dragging");
    document.body.classList.add(direction);
    handler.classList.add("dragging");

    setActualSizeOfSiblings();

    if (props.freezeOtherPanel) {
      freezeNonAdjacentElements("freeze");
    }

    // Get start/end of siblings
    updatePanelRectSize();
    // console.debug("[1]Prev Node:", prevEle, prevRect);
    // console.debug("[1]Next Node:", nextEle, nextRect);
    console.debug("direction:", direction, [start, end]);

    // update info box
    updateInfo();

    // Store panel size (if dragged to collapsed, store it for expanding)
    saveAdjacentSize();

    // Calculate the valid range while dragging
    const clamp = (v: number): number =>
      Math.min(Math.max(v, start + prevMinSize), end - nextMinSize - 1);

    // -------------------- Drag move - START
    const dragMove = (e: MouseEvent | TouchEvent) => {
      // Calculate siblings' size
      console.debug("e.type:", e.type, e);
      const src: MouseEvent | Touch =
        e.type === "mousemove"
          ? (e as MouseEvent)
          : (e as TouchEvent).touches[0];
      const current = direction === "LR" ? src.clientX : src.clientY;

      let prevSize;
      let nextSize;
      if (
        start + props.collapseThreshold <= current &&
        current <= end - props.collapseThreshold
      ) {
        // Between the sublings
        prevSize = Math.round(clamp(current - halfSize) - start);
        nextSize = end - start - props.size - prevSize;
        prevEle.style[dimension] = `${prevSize}px`;
        nextEle.style[dimension] = `${nextSize}px`;

        clearCollapsePropertiesOfAdjacent();
      } else {
        let sizeDict = {};
        if (
          current < start + props.collapseThreshold &&
          props.prevCollapsible
        ) {
          sizeDict = collapsePanel("prev");
        } else if (
          current > end - props.collapseThreshold &&
          props.nextCollapsible
        ) {
          sizeDict = collapsePanel("next");
        }
        prevSize = sizeDict["prevSize"];
        nextSize = sizeDict["nextSize"];
      }

      updateInfo();

      console.debug(
        `Range:${Math.round(start)}-${Math.round(end)} | Current:${Math.round(
          current
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
      document.body.classList.remove("body-on-dragging");
      document.body.classList.remove(direction);
      handler.classList.remove("dragging");

      setCollapseStatusOfSiblings();
      freezeNonAdjacentElements("unfreeze");

      // Save panel size
      saveAllPanelsSize();
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
  const clickCollapsePanelBtn = (e: Event): void => {
    const btnEle = e.target as Element;
    // console.debug("🎈 Collapse Btn", e, btnEle.classList);
    e.stopPropagation();
    // freezeNonAdjacentElements("freeze");

    // Get direction
    const btnDir = btnEle.classList.contains("prev") ? "prev" : "next";
    console.debug("Collapse btn direction:", btnDir);

    updatePanelRectSize();
    console.debug(
      `Size: Prev=${prevRect[dimension]} | Next=${nextRect[dimension]}`,
      prevRect,
      nextRect
    );

    // Collapse or Expand
    if (
      prevRect[dimension] < prevCollapsedSize + 10 ||
      nextRect[dimension] < nextCollapsedSize + 10
    ) {
      console.debug(`✅ Expand -> ${btnDir}`); // expand --------------------
      expandPanel(btnDir);
    } else {
      console.debug(`✅ Collapse -> ${btnDir}`); // collapse --------------------
      // Store the size of expand status
      saveAdjacentSize();

      collapsePanel(btnDir);
    }

    // Add transition of neighbor
    const targetHdl = btnDir === "prev" ? prevHdl : nextHdl;
    prevEle.classList.add("collapse-transition");
    nextEle.classList.add("collapse-transition");
    handler.classList.add("collapse-transition");
    targetHdl?.classList.add("collapse-transition");

    setTimeout(() => {
      prevEle.classList.remove("collapse-transition");
      nextEle.classList.remove("collapse-transition");
      handler.classList.remove("collapse-transition");
      targetHdl?.classList.remove("collapse-transition");

      /**
       * If the :has selector is used, the previous configuration is sufficient.
       * Handler preceding the collapsed ele is .resize-handler:has(+ .collapsed)
       * However, to ensure compatibility with older browsers,
       * it's necessary to add a class to the elements preceding the handler.*/
      setCollapseStatusOfSiblings();
      // freezeNonAdjacentElements("unfreeze");
      saveAllPanelsSize();
    }, 1000);
  };
  handler.querySelectorAll(".collapse-btn").forEach((btn) => {
    btn.addEventListener("click", clickCollapsePanelBtn);
  });
  // -------------------- Collapse Previous - END

  /**
   * ------------------------------ Write all siblings' size - START
   * Avoid flex getting wrong size due to other siblings
   * Flex automatically adjusts the size after it has been set, so setting the size one by one is not possible. For example, if the size of the first sibling is set to the current width, while the other siblings still have incorrect size properties, flex will calculate again and the size of the first sibling will change again. This process will continue for each sibling, resulting in incorrect sizes. After several iterations, the values will be very close to the correct sizes.
   * Another problem is that the handler may have a different size than props.size due to flex properties. To resolve this, we need to set the handler size to a preset value and adjust the panel size based on the remaining space.
   */
  const setActualSizeOfSiblings = () => {
    console.group("Set Actual Size of Siblings");
    let parentSize = 0;
    let collapsedPanelList: { ele: HTMLElement; size: number }[] = [];
    let expandedPanelList: { ele: HTMLElement; size: number }[] = [];
    let siblingsSizeTotal = 0;
    // Get size of all siblings
    getSiblings().forEach((ele) => {
      // Minus handler size (without flex)
      if (isHandler(ele)) return;

      const rect = ele.getBoundingClientRect();
      parentSize += rect[dimension];
      const size =
        rect[dimension] <= props.collapsedSize + 10
          ? props.collapsedSize
          : rect[dimension]; // collapse tiny
      if (size === props.collapsedSize) {
        collapsedPanelList.push({ ele: ele, size: size });
      } else {
        expandedPanelList.push({ ele: ele, size: size });
      }
      siblingsSizeTotal += size; // fill parent container
    });
    console.debug(
      `Sibling size total: ${siblingsSizeTotal} | Parent: ${parentSize}`
    );

    /**
     * Set size of all siblings
     * Prevent the last panel left 1px caused by Math.round of the previous panel
     * Set the zero size first, then calculate the non-zero sizes.  */
    collapsedPanelList.forEach((item) => {
      item.ele.style[dimension] = `${props.collapsedSize}px`;
      parentSize -= props.collapsedSize;
    });
    const ratio = parentSize / siblingsSizeTotal;
    for (let i = 0; i < expandedPanelList.length; i++) {
      const item = expandedPanelList[i];
      let size = 0;
      if (i < expandedPanelList.length - 1) {
        size = Math.round(item.size * ratio);
        parentSize -= size;
      } else {
        size = parentSize; // The final panel uses all the remaining space
      }
      item.ele.style[dimension] = size + "px";
      console.debug(`Set sibling [${item.ele.id}] ${item.size} -> ${size}px`);
    }
    console.groupEnd();
  };
  // ------------------------------ Write all siblings' size - END

  // ------------------------------ Update all siblings' info - START
  const updateInfoOfSiblings = () => {
    for (let ele of getSiblings()) {
      if (isHandler(ele)) {
        const prevEle = ele.previousElementSibling as HTMLElement;
        const nextEle = ele.nextElementSibling as HTMLElement;
        const prevRect = prevEle?.getBoundingClientRect(); // for calc direction
        const nextRect = nextEle?.getBoundingClientRect(); // for calc direction
        const prevInfo = ele.querySelector(".panel-info.prev") as HTMLElement;
        const nextInfo = ele.querySelector(".panel-info.next") as HTMLElement;
        prevInfo.textContent = `${Math.round(prevRect[dimension] * 100) / 100}`;
        nextInfo.textContent = `${Math.round(nextRect[dimension] * 100) / 100}`;
      }
    }
  };
  // ------------------------------ Update all siblings' info - END

  // ------------------------------ Modify siblings' collapsed status - START
  const setCollapseStatusOfSiblings = () => {
    const siblingList = getSiblings();
    // console.debug("siblingList:", siblingList);
    for (let i = 0; i < siblingList.length; i++) {
      const ele = siblingList[i];
      if (isHandler(ele)) continue; //watch panels only
      const size = ele.getBoundingClientRect()[dimension];
      // console.debug("size:", size, ele.id, i);
      const attrMinSize = ele.getAttribute("data-collapsed-size");
      const minSize = attrMinSize ? parseInt(attrMinSize) : 10;
      if (size <= minSize + 10) {
        console.debug("👻 Collapsed panel found:", ele);
        // Set very tiny panel to collapsed
        if (!isHandler(ele)) {
          ele.classList.add("panel-collapsed");
        }
        // Set property of prev handler
        if (i > 0 && isHandler(siblingList[i - 1])) {
          siblingList[i - 1].classList.add("next-panel-collapsed");
        }
        // Set property of next handler
        if (i + 1 < siblingList.length && isHandler(siblingList[i + 1])) {
          siblingList[i + 1].classList.add("prev-panel-collapsed");
        }
      } else {
        // Set very tiny panel to collapsed
        if (!isHandler(ele)) {
          ele.classList.remove("panel-collapsed");
        }
        // Set property of prev handler
        if (i > 0 && isHandler(siblingList[i - 1])) {
          siblingList[i - 1].classList.remove("next-panel-collapsed");
        }
        // Set property of next handler
        if (i + 1 < siblingList.length && isHandler(siblingList[i + 1])) {
          siblingList[i + 1].classList.remove("prev-panel-collapsed");
        }
      }
    }
    setActualSizeOfSiblings();
    updateInfoOfSiblings();
  };
  // ------------------------------ Modify siblings' collapsed status - END

  // ------------------------------ Store & Restore Panel Size - START
  const saveAllPanelsSize = (): void => {
    console.group("💾 Save All Panel's Size");
    const siblingList = getSiblings();
    for (let ele of siblingList) {
      if (isHandler(ele)) continue;
      if (ele.id) {
        let sizeInfo: SizeObj = {
          [dimension]: ele.getBoundingClientRect()[dimension],
        };
        saveSize(ele.id, sizeInfo);
        // console.debug(`Save Size: ele.id=${ele.id}`, sizeInfo);
      }
    }
    console.debug(loadSize());
    console.groupEnd();
  };

  const saveAdjacentSize = () => {
    const prevSize = prevEle.getBoundingClientRect()[dimension];
    if (prevSize > prevCollapsedSize + 10) {
      saveSize(prevEle.id, { [dimension]: prevSize }, lsBeforeCollapseKey);
    }
    const nextSize = nextEle.getBoundingClientRect()[dimension];
    if (nextSize > nextCollapsedSize + 10) {
      saveSize(nextEle.id, { [dimension]: nextSize }, lsBeforeCollapseKey);
    }
  };

  const restoreAllPanelSize = () => {
    console.group("🍕 Restore panel size");
    const siblingList = getSiblings();
    for (let ele of siblingList) {
      if (isHandler(ele)) continue;
      console.debug("ele:", ele, ele.id);
      const styleDict = loadSize(ele.id);
      if (styleDict) {
        for (let styleName in styleDict) {
          ele.style[styleName] = styleDict[styleName] + "px";
        }
      }
    }

    setCollapseStatusOfSiblings();
    console.groupEnd();
  };
  restoreAllPanelSize();
  // ------------------------------ Store & Restore Panel Size - END

  updateInfoOfSiblings();
  console.groupEnd(); // init end
};

onMounted(() => {
  console.debug("🎯🎯🎯 Mounted", refHandler.value);

  // Add event/listener to handler
  initHandler(refHandler.value);
});
// ------------------------------ drag - END
</script>

<style lang="scss" scoped>
.resize-handler {
  flex: none !important;
  z-index: 99;
  box-sizing: border-box;
  color: var(--color);

  // For child element
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;

  // .hover-indicator (hover status)
  .hover-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--indicator-color);
    opacity: 0;
    // opacity: 0.5; //debug
    transition: opacity 0.5s;

    &,
    &::after {
      width: 100%;
      height: 100%;
      position: absolute; // bigger size than parent
    }
    // Invisible hoverable area
    &::after {
      content: "";
      display: block;
      // background: #0f09; //debug
      transition: width 0.2s, height 0.2s;
      z-index: -1;
    }
  }

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

  /**
   * Handler of LR
   * Directly set width/height will cause 1px expand to 1.5px on windows,
   * which will appear as 2px. To maintain a 1px appearance, use border here.
   * If the size is an odd number, right/bottom has higher priority.
   */
  &.LR {
    border-left: calc((var(--size) - 1px) / 2) solid;
    border-right: calc((var(--size) + 1px) / 2) solid;
    cursor: ew-resize;
    flex-direction: row; // for prev/next align setting

    .hover-indicator {
      width: var(--indicator-size);
      flex-direction: row; // for prev/next align setting

      &::after {
        width: max(var(--size), var(--hover-size)); // hover area
      }
    }
  }

  // Handler of TB
  &.TB {
    border-top: calc((var(--size) - 1px) / 2) solid;
    border-bottom: calc((var(--size) + 1px) / 2) solid;
    cursor: ns-resize;
    flex-direction: column; // for prev/next align setting

    .hover-indicator {
      height: var(--indicator-size);
      flex-direction: column; // for prev/next align setting

      &::after {
        height: max(var(--size), var(--hover-size)); // hover area
      }
    }
  }

  // ------------------------------ Collapse Button - START
  // ::before = background
  // ::after = arrow
  --gap: 0.5rem; //between button and indicator
  --edge-l: 3rem;
  --edge-s: 1rem;
  --arrow: 0.5rem;
  --fadein: cubic-bezier(0.25, 0.1, 0.5, 1.5);
  --fadeout: cubic-bezier(0.25, -0.5, 0.5, 1);
  .collapse-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--gap);
    position: absolute;
    cursor: pointer;
    z-index: -1;
    opacity: 0; //product
    transform: scale(0); //product
    // border: 1px solid red; //debug
    // opacity: 0.5; //debug
    // transform: scale(1); //debug
    transition: opacity 0.5s, transform var(--fadeout) 0.5s;

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

    &.non-collapsible {
      display: none;
    }
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
      right: calc(var(--size) / 2);
      transform-origin: right;
      &::after {
        border-right: var(--arrow) solid;
      }
    }
    &.next {
      left: calc(var(--size) / 2);
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
      bottom: calc(var(--size) / 2);
      transform-origin: bottom;
      &::after {
        border-bottom: var(--arrow) solid;
      }
    }
    &.next {
      top: calc(var(--size) / 2);
      transform-origin: top;
      &::after {
        border-top: var(--arrow) solid;
      }
    }
  }

  // When the handler is hovered over, the collapse button appears
  &:hover .collapse-btn {
    opacity: 1;
    transform: scale(1) !important;
    // Transition delay, avoid the btn appearing while cursor is passing over
    transition: opacity 0.2s 0.3s, transform 0.2s var(--fadein) 0.3s;
  }

  // Maintain a small size while collapsed for easy activation.
  &.prev-panel-collapsed .collapse-btn.next,
  &.next-panel-collapsed .collapse-btn.prev {
    transform: scale(0.5);
    display: flex !important; // non-collapsible btn, should allow for expand
  }

  // If the handler is already collapsed, there's no need for a delay
  &.prev-panel-collapsed,
  &.next-panel-collapsed {
    &:hover .collapse-btn {
      transition: opacity 0.2s, transform 0.2s var(--fadein);
    }
  }
  // ------------------------------ Collapse Button - END

  // ------------------------------ Info box - START
  .panel-info {
    background: #3339;
    margin: var(--gap);
    padding: 0 var(--gap);
    border-radius: 1rem;
    font-size: clamp(10px, 0.75rem, 14px);
    font-family: monospace;
    height: var(--edge-s);
    line-height: var(--edge-s);
    color: #fff;
    opacity: 0;
    transform: scale(0);
    z-index: -2;
    // opacity: 0.5; //debug
    // transform: scale(1); //debug
    transition: opacity 0.2s, transform 0.2s var(--fadeout);
    position: absolute;
  }
  &.LR .panel-info {
    align-self: flex-end;
    &.prev {
      right: calc(var(--size) / 2);
    }
    &.next {
      left: calc(var(--size) / 2);
    }
  }

  &.TB .panel-info {
    align-self: flex-start;
    &.prev {
      bottom: calc(var(--size) / 2);
    }
    &.next {
      top: calc(var(--size) / 2);
    }
  }
  &.dragging,
  &:hover {
    .panel-info {
      opacity: 0.75;
      transform: scale(1);
    }
  }
  // ------------------------------ Info box - END
}
</style>

<style lang="scss">
// Collapse panel
// Prevent size change while window size expand
// freeze class will be added by js
.panel-collapsed,
.freeze {
  flex: none !important;
  min-width: unset !important;
  min-height: unset !important;
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

.panel-collapsed-view {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  z-index: -1;
  user-select: none;
}
.panel-collapsed {
  position: relative;

  // ------------------------------ Collapsed handler - START
  .panel-collapsed-view {
    background: red;
    z-index: 99;
    user-select: normal;
    opacity: 1;
    transition: opacity 0.5s;
  }
  // ------------------------------ Collapsed handler - END

  // The hanlder of sub-panel, which parent panel is collapsed.
  .resize-handler {
    display: none;
  }
}

// While dragging, prevent text be selected. Added to body.
.body-on-dragging {
  &,
  & * {
    user-select: none;
  }
  &.LR {
    cursor: ew-resize;
  }
  &.TB {
    cursor: ns-resize;
  }
}

// Parent
.handler-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  & > * {
    flex-grow: 1;
  }
}

// Apply animation to the panel while collapsing and expanding.
.collapse-transition {
  --fadein: cubic-bezier(0.25, 0.1, 0.5, 1.5);
  transition: width var(--fadein) 0.5s, height var(--fadein) 0.5s !important;
  min-width: unset !important;
  min-height: unset !important;
}
.drag-transition {
  transition: width 0.1s, height 0.1s;
}
</style>
