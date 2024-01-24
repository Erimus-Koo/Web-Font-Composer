<!--
## 1. Resize Handler
- This is a resize handler.
- Direction could be LR(left/right) or TB(top/bottom)
- The siblings are named prev(top/left) and next(bottom/right) 
- The sizes of panels will be store in local storage, name `panelSize`.

## 2. Out of this component
In order to make this component compatible with more older projects, it will 
automatically add a small amount of styles and attributes to the parent element 
and sibling elements.
- The style section begins with `<style lang="scss">`.
- Most of the JavaScript code is located in the initHandler and dragStart.


### 2.1 Body
- While dragging the handler, there is a style that prevents mouse events.

### 2.2 Parent Element
- The parent element should display as flex, and this component will set style
  of the parent element. 

### 2.3 Panel ✨
- Sibling nodes will be automatically treated as resizable panels.
- The panel must has an unique #ID to store its size 👀.

#### 2.3.1 Panel props
- data-min-size: 👀 number[int/str], pixel of the panel recommend min size.
- data-collpased-size: 👀 number[int/str], pixel of the panel collapsed size.
  Default is `props.collapsedSize`
- data-non-collapsible: bool, panel can not be collapsed.
  This attribute only works if the panel has a minimum size.

#### 2.3.2 Panel Collapsed View 👀
- The element is only displayed when the panel is collapsed.
- Use the class name `.panel-collapsed-view`.
- The default panel color is white and its size is `porps.collapsedSize`.
- You can add a customized div with `.panel-collapsed-view` to display 
  additional content, such as the names of collapsed tabs.

 -->
<template>
  <div
    class="resize-handler"
    v-bind="$attrs"
    :style="
      `--size:${size}px;` +
      `--border-prev-width:${Math.floor(size / 2)}px;` +
      `--border-next-width:${Math.ceil(size / 2)}px;` +
      `--hover-size:${hoverSize}px;` +
      `--color:${color};` +
      `--indicator-size:${indicatorSize}px;` +
      `--indicator-color:${indicatorColor};`
    "
    ref="refHandler"
  >
    <!-- display while mouse hover & expand hover area -->
    <div class="hover-indicator">
      <!-- the collapse buttons -->
      <div class="collapse-btn prev" />
      <div class="collapse-btn next" />

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
    collapseThreshold?: number; // Threshold for automatic panel snapping

    // adjacent elements
    collapsedSize?: number; // While collapsed, set a min size to indentify
    collapsedBg?: string; // BG of collapsed hander, border is handler color

    /** Resize Adjacent Element Only
     * The main difference is about the size limit panel
     * e.g. start=100, left panel w=200, right panel w/min-w=200, end=500
     * If true, the other panels will be frozen. The handler for moving right may appear to not work because it reaches the min-width of the right panel.
     * If false, the other panels can be resized. For instance, moving the handler from 300 to 400 will cause the left panel to expand. However, due to flex, the width may not be exact.*/
    freezeOtherPanel?: boolean;
  }>(),
  {
    size: 1,
    hoverSize: 10,
    color: "#333",
    indicatorSize: 2,
    indicatorColor: "#06f",
    collapseThreshold: 50,
    collapsedSize: 5,
    collapsedBg: "#eee",
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

// ------------------------------ Store size - START
const lsKey = "panelSize"; // local storage key of panel size
const lsBeforeCollapseKey = "beforeCollapse"; // key of the size before collapse

type SizeObj = { width?: number; height?: number };

// If panelId is provided, return the size of that specific panel.
// Otherwise, return the entire dictionary of stored sizes.
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
// ------------------------------ Store size - END

// ------------------------------ Init - START
const initHandler = (
  handler: HTMLElement // element
): void => {
  console.group("Init handler", handler);

  // Add style to parent
  let parentEle = handler.parentElement;
  parentEle?.classList.add("handler-wrapper");

  // Define adjacent elements
  let prevEle = handler.previousElementSibling as HTMLElement;
  let nextEle = handler.nextElementSibling as HTMLElement;
  let prevRect = prevEle?.getBoundingClientRect(); //for calc direction
  let nextRect = nextEle?.getBoundingClientRect(); //for calc direction
  console.debug("[init] Prev Ele:", prevEle, prevRect);
  console.debug("[init] Next Ele:", nextEle, nextRect);
  if (!(prevEle && nextEle)) return; //Do not resize without siblings

  // Check if element is handler
  const isHandler = (ele: HTMLElement): boolean =>
    ele && ele.classList.contains("resize-handler"); //ele might be null

  // Get handler of adjacent elements
  const _prevPrev = prevEle.previousElementSibling as HTMLElement;
  let prevHdl = isHandler(_prevPrev) ? _prevPrev : undefined;
  const _nextNext = nextEle.nextElementSibling as HTMLElement;
  let nextHdl = isHandler(_nextNext) ? _nextNext : undefined;
  console.debug("[init]Prev Handler:", prevHdl);
  console.debug("[init]Next Handler:", nextHdl);

  // Init info box
  const prevInfo = handler.querySelector(".panel-info.prev") as HTMLElement;
  const nextInfo = handler.querySelector(".panel-info.next") as HTMLElement;

  // Define vaiables and common functions
  let start = 0; // Previous node top/left
  let end = window.innerWidth; // Next node bottom/right

  // Determine the handler direction by adjacent elements
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
  } else {
    console.error("Can not determimne the direction of handler", handler);
    return;
  }
  handler.classList.add(direction);
  dimension = direction === "LR" ? "width" : "height";
  console.debug("Direction:", direction, dimension, prevRect, nextRect);

  // Check the ID of adjacent elements, no ID panel's size won't be store.
  if (!prevEle.id || !nextEle.id) {
    console.warn("The adjacent elements must have ID", prevEle, nextEle);
  }

  // ------------------------------ Get all siblings - START
  const getSiblings = (): HTMLElement[] => {
    let siblingList: HTMLElement[] = [];
    if (!handler.parentElement) return siblingList;

    let element = handler.parentElement?.firstElementChild as HTMLElement;
    do {
      if (!element.classList.contains("panel-collapsed-view")) {
        siblingList.push(element);
      }
    } while ((element = element?.nextElementSibling as HTMLElement));

    // console.debug(`👬🏻 siblingList:`, siblingList);
    return siblingList;
  };
  // ------------------------------ Get all siblings - END

  // ------------------------------ Create view of collapsed panels - START
  // panel-collapsed-view is a special div only display when panel is collapsed
  getSiblings().forEach((ele) => {
    // Create view div
    if (
      !isHandler(ele) && //skip handler
      !ele.querySelector(".panel-collapsed-view") && //view existed
      !ele.classList.contains("panel-collapsed-view") //self is view
    ) {
      let collapsedPanelView = document.createElement("div");
      collapsedPanelView.classList.add("panel-collapsed-view");
      ele.appendChild(collapsedPanelView);
    }
  });
  // ------------------------------ Create view of collapsed panels - END

  // ------------------------------ Update size of adjacent elements - START
  const getCS = (ele: HTMLElement): number =>
    parseInt(
      ele.getAttribute("data-collapsed-size") || `${props.collapsedSize}`
    );
  const getCollapsible = (ele: HTMLElement): boolean => {
    const _NON = ele.getAttribute("data-non-collapsible");
    return !(_NON === "" || _NON?.toLowerCase() === "true");
  };
  const updatePanelRectSize = () => {
    // Update rect
    prevRect = prevEle.getBoundingClientRect();
    nextRect = nextEle.getBoundingClientRect();

    // Update start/end
    if (direction === "LR") {
      start = prevRect.x;
      end = nextRect.x + nextRect.width;
    } else if (direction === "TB") {
      start = prevRect.y;
      end = nextRect.y + nextRect.height;
    }

    // Update panel collapsed size
    // The size might be set in em units and needs to be updated regularly.
    // ※ If the data-collapsed-size does not exist, it will be set at init.
    for (let ele of [prevEle, nextEle]) {
      const _MS = ele.getAttribute("data-min-size");
      if (ele === prevEle) {
        prevCollapsedSize = getCS(ele);
        prevMinSize = _MS ? parseInt(_MS) : prevCollapsedSize;
        if (!getCollapsible(ele))
          handler
            .querySelector(".collapse-btn.prev")
            ?.classList.add("non-collapsible");
      } else {
        nextCollapsedSize = getCS(ele);
        nextMinSize = _MS ? parseInt(_MS) : nextCollapsedSize;
        if (!getCollapsible(ele))
          handler
            .querySelector(".collapse-btn.next")
            ?.classList.add("non-collapsible");
      }
    }
    console.debug(
      `CollapsedSize: prev=${prevCollapsedSize} next=${nextCollapsedSize}` +
        `MinSize: prev=${prevMinSize} next=${nextMinSize}`
    );

    // Write min size to panel
    // const attribute = dimension === "width" ? "minWidth" : "minHeight";
    // prevEle.style[attribute] = `${prevMinSize}px`;
    // nextEle.style[attribute] = `${nextMinSize}px`;
  };
  updatePanelRectSize();
  // ------------------------------ Update size of adjacent elements - END

  // ------------------------------ Update info content - START
  const updateInfo = (ele = handler) => {
    const prevEle = ele.previousElementSibling as HTMLElement;
    const nextEle = ele.nextElementSibling as HTMLElement;
    const prevRect = prevEle?.getBoundingClientRect();
    const nextRect = nextEle?.getBoundingClientRect();
    const prevInfo = ele.querySelector(".panel-info.prev") as HTMLElement;
    const nextInfo = ele.querySelector(".panel-info.next") as HTMLElement;
    prevInfo.textContent = `${Math.round(prevRect[dimension] * 100) / 100}`;
    nextInfo.textContent = `${Math.round(nextRect[dimension] * 100) / 100}`;
  };
  // ------------------------------ Update info content - END

  // ------------------------------ Update all siblings' info - START
  const updateInfoOfSiblings = () => {
    for (let ele of getSiblings()) {
      if (isHandler(ele)) updateInfo(ele);
    }
  };
  // ------------------------------ Update all siblings' info - END

  // ------------------------------ Collapse & Expand Panel - START
  const changeCollapsePropertiesOfPanel = (
    panelElement: HTMLElement,
    func: "add" | "remove"
  ) => {
    panelElement.classList[func]("panel-collapsed");
    const prevHandler = panelElement.previousElementSibling as HTMLElement;
    if (isHandler(prevHandler))
      prevHandler.classList[func]("next-panel-collapsed");
    const nextHandler = panelElement.nextElementSibling as HTMLElement;
    if (isHandler(nextHandler))
      nextHandler.classList[func]("prev-panel-collapsed");
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
    updatePanelRectSize();
    const targetEle = collapseDirection === "prev" ? prevEle : nextEle;
    const anotherEle = collapseDirection === "next" ? prevEle : nextEle;
    const targetHdl = collapseDirection === "prev" ? prevHdl : nextHdl;

    const oppositeDirection = collapseDirection === "prev" ? "next" : "prev";
    const fullSize = end - start - props.size;
    const targetSize =
      collapseDirection === "prev" ? prevCollapsedSize : nextCollapsedSize;
    const anotherSize = fullSize - targetSize;
    targetEle.style[dimension] = `${targetSize}px`;
    anotherEle.style[dimension] = `${anotherSize}px`;
    console.debug(
      `start:${start} end:${end} end-start:${end - start} ` +
        `full:${fullSize} target:${targetSize} another:${anotherSize}`
    );

    // Change styles
    changeCollapsePropertiesOfPanel(targetEle, "add");

    addPanelTransition("drag-transition", 200);
  };

  const expandPanel = (expandDirection: "prev" | "next"): void => {
    // updatePanelRectSize();
    // targetEle = Which panel will be expanded
    const targetEle = expandDirection === "prev" ? nextEle : prevEle;
    const anotherEle = expandDirection === "next" ? nextEle : prevEle;
    const fullSize = end - start - props.size; // handler changes

    // Read stored size
    const storedSize = loadSize(targetEle.id, lsBeforeCollapseKey)[dimension];
    const minSize = Math.max(fullSize / 2, props.collapseThreshold);
    console.debug(
      `🍉 storedSize:${storedSize} ` +
        `start:${start} end:${end} end-start:${end - start} ` +
        `full:${fullSize} storedSize:${storedSize} minSize:${minSize}`
    );
    const targetSize = Math.round(
      !storedSize || // no stored size
        (storedSize && storedSize >= fullSize - props.collapseThreshold) // invalid
        ? minSize // set as min size
        : storedSize
    );
    targetEle.style[dimension] = targetSize + "px";
    anotherEle.style[dimension] = fullSize - targetSize + "px";
    console.debug(`target:${targetSize} another:${fullSize - targetSize}`);

    // Remove collapsed classes
    changeCollapsePropertiesOfPanel(targetEle, "remove");

    addPanelTransition("drag-transition", 200);
  };
  // ------------------------------ Collapse & Expand Panel - END

  // -------------------- Drag start - START
  const dragStart = () => {
    console.debug("🔫 Drag Start");

    // Prevent text be selected while mouse move
    document.body.classList.add("body-on-dragging");
    document.body.classList.add(direction);
    handler.classList.add("dragging");

    setActualSizeOfSiblings();

    // freezeNonAdjacentElements("freeze");

    // Get start/end of siblings
    updatePanelRectSize();
    console.debug("direction:", direction, [start, end]);

    // Store panel size (if dragged to collapsed, store it for expanding)
    saveAllPanelsSize(lsBeforeCollapseKey);

    // ------------------------------ Prepare for move - START
    let distance: number = 0;
    type SizeListObj = Array<{
      ele: HTMLElement;
      type: "handler" | "number";
      size: number; //Actual size (Panel or Handler)
      minSize: number; //Panel min size
      collapsedSize: number; //Panel collapsed size
      collapsible: boolean;
    }>;
    const siblingSizeList = getSiblings().map((ele) => ({
      ele: ele,
      type: isHandler(ele) ? "handler" : "panel",
      size: ele.getBoundingClientRect()[dimension],
      minSize: parseInt(ele.getAttribute("data-min-size") || `${getCS(ele)}`),
      collapsedSize: getCS(ele),
      collapsible: getCollapsible(ele),
    }));
    const thisIndex = getSiblings().indexOf(handler);
    const prevSiblingSizeList = siblingSizeList.slice(0, thisIndex).reverse();
    const nextSiblingSizeList = siblingSizeList.slice(thisIndex + 1);
    // If end-start<prevMin+nextMin,
    // or the start state size less than min size, ignore min size.
    const _prevEle = prevSiblingSizeList[0];
    const _nextEle = nextSiblingSizeList[0];
    const totalSizeLtMinSize =
      _prevEle.size + _nextEle.size < _prevEle.minSize + _nextEle.minSize;
    const prevSizeLtMinSize = _prevEle.size < _prevEle.minSize;
    const nextSizeLtMinSize = _nextEle.size < _nextEle.minSize;
    if ((prevSizeLtMinSize || totalSizeLtMinSize) && _prevEle.collapsible) {
      _prevEle.minSize = _prevEle.collapsedSize;
    }
    if ((nextSizeLtMinSize || totalSizeLtMinSize) && _nextEle.collapsible) {
      _nextEle.minSize = _nextEle.collapsedSize;
    }

    const dragStartPoint =
      handler.getBoundingClientRect()[direction === "LR" ? "x" : "y"] +
      props.size / 2;
    console.debug(
      `Drag start point=${dragStartPoint} | Index=${thisIndex} | ` +
        `\nSibling Size List:`,
      prevSiblingSizeList,
      nextSiblingSizeList
    );

    const calcPanelsSize = (
      to: "prev" | "next",
      distance: number //Handler move distance
    ) => {
      /** Calculate the new size of siblings and set the size
       * Read the draw.io graph in doc folder for more details
       */
      console.group("Calc Panel Size:", to, distance);

      let _siblingSizeList: SizeListObj = (
        to === "prev" ? prevSiblingSizeList : nextSiblingSizeList
      ) as SizeListObj;

      // Calculate panel size
      let result: { ele: HTMLElement; oldSize: number; newSize: number }[] = [];
      let _start = distance; //Offset at start
      let _end = 0; //Total end of before
      let virtualEnd = distance; //Total end of after
      for (let i = 0; i < _siblingSizeList.length; i++) {
        const item = _siblingSizeList[i];
        const size = item.size;
        const ms = item.minSize;
        const cs = item.collapsedSize;
        let newSize = 0; //New size of current panel
        let stopPropagation = true;
        _end += size;
        console.debug(
          `✨[${i}] ${item.type} ${item.ele.id} start=${_start} end=${_end} ` +
            `min=${ms} collapse=${cs}`
        );

        if (item.type === "handler") {
          console.debug(`🔵 Handler ${item.ele.id}`);
          newSize = size;
          stopPropagation = false;
        } else if (_start <= _end - ms) {
          // Does not reach the minSize
          newSize = _end - _start;
          console.debug(`🟢 Free ${item.ele.id}`);
        } else if (
          _start <= _end - cs - props.collapseThreshold &&
          item.collapsible
        ) {
          // Less than min size, but doesn't collapse, keep the min size
          newSize = ms;
          console.debug(`🟡 Min ${item.ele.id}`);
        } else if (_start <= _end - cs && item.collapsible) {
          // Great than collapse threshold, panel collapse
          newSize = cs;
          console.debug(`🟠 Collapse ${item.ele.id}`);
        } else if (item.collapsible) {
          // Push next panel
          newSize = cs;
          console.debug(`🔴 Over ${item.ele.id} next_start=${_start} `);
          stopPropagation = false;
        } else {
          newSize = ms;
          console.debug(
            `🔴 Over(non-collapsible) ${item.ele.id} next_start=${_start} `
          );
          stopPropagation = false;
        }
        result.push({ ele: item.ele, oldSize: size, newSize: newSize });
        _start += newSize;
        virtualEnd += newSize;
        console.debug(
          `end=${_end} virtualEnd=${virtualEnd} offset=${_end - virtualEnd} ` +
            `oldSize=${size} newSize=${newSize} stop=${stopPropagation}`
        );

        changeCollapsePropertiesOfPanel(
          item.ele,
          newSize === cs ? "add" : "remove"
        );

        if (stopPropagation) break;
      }
      let offset = _end - virtualEnd;
      console.debug(
        `🚩to:${to} distance:${distance} offset:${offset}\n` + `result:`,
        result
      );
      console.groupEnd();

      return { sizeList: result, offset: offset };
    };
    // ------------------------------ Prepare for move - END

    // -------------------- Drag move - START
    const dragMove = (e: MouseEvent | TouchEvent) => {
      // Calculate siblings' size
      // console.debug("e.type:", e.type, e);
      const src: MouseEvent | Touch =
        e.type === "mousemove"
          ? (e as MouseEvent)
          : (e as TouchEvent).touches[0];
      const current = direction === "LR" ? src.clientX : src.clientY;
      const maxLimit =
        direction === "LR" ? window.innerWidth : window.innerHeight;

      const to = current > dragStartPoint ? "next" : "prev";
      const moveDistance = Math.round(Math.abs(current - dragStartPoint));
      if (moveDistance === distance || current < 0 || current > maxLimit)
        return; //if no move gt 1px, don't calc

      distance = moveDistance;
      const newSizeObj = calcPanelsSize(to, distance);

      // Set value
      newSizeObj.sizeList.forEach((item) => {
        item.ele.style[dimension] = `${item.newSize}px`;
        console.debug(`${item.ele.id} ${item.oldSize} ${item.newSize}`);
      });

      // Get old size of opposite element
      const oppositeItem = (
        to === "next" ? prevSiblingSizeList : nextSiblingSizeList
      )[0];
      const opOldSize = oppositeItem.size;
      const opNewSize = opOldSize + (distance + newSizeObj.offset);
      oppositeItem.ele.style[dimension] = `${opNewSize}px`;
      changeCollapsePropertiesOfPanel(
        oppositeItem.ele,
        opNewSize === oppositeItem.collapsedSize ? "add" : "remove"
      );
      console.debug(
        `Opposite Ele: ${opOldSize} -> ${opNewSize} (${opNewSize - opOldSize})`
      );

      updateInfo();
    };
    document.onmousemove = dragMove;
    document.ontouchmove = dragMove;
    // -------------------- Drag move - END

    // -------------------- Drag end - START
    const dragEnd = () => {
      console.debug(`🏁 Drag End`);
      document.onmousemove = null;
      document.ontouchmove = null;
      document.onmouseup = null;
      document.ontouchend = null;
      document.body.classList.remove("body-on-dragging");
      document.body.classList.remove(direction);
      handler.classList.remove("dragging");

      setCollapseStatusOfSiblings();
      // freezeNonAdjacentElements("unfreeze");

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
    const transitionDuration = 1000;
    console.debug("🎈 Collapse Btn", e, btnEle.classList);
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
      addPanelTransition("expand-transition", transitionDuration);
    } else {
      console.debug(`✅ Collapse -> ${btnDir}`); // collapse --------------------
      // Store the size of expand status
      saveAllPanelsSize(lsBeforeCollapseKey);

      collapsePanel(btnDir);
      addPanelTransition("collapse-transition", transitionDuration);
    }

    setTimeout(() => {
      /**
       * If the :has selector is used, the previous configuration is sufficient.
       * Handler preceding the collapsed ele is .resize-handler:has(+ .collapsed)
       * However, to ensure compatibility with older browsers,
       * it's necessary to add a class to the elements preceding the handler.*/
      setCollapseStatusOfSiblings();
      // freezeNonAdjacentElements("unfreeze");
      saveAllPanelsSize();
    }, transitionDuration);
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
    let collapsedPanelList: { ele: HTMLElement; size: number }[] = [];
    let expandedPanelList: { ele: HTMLElement; size: number }[] = [];
    let panelSizeBefore = 0; // all panel total
    let panelSizeAfter = 0; // all panel total(adjust collapsed panel)
    // Get size of all siblings
    getSiblings().forEach((ele) => {
      // Minus handler size (without flex)
      if (isHandler(ele)) return;

      const rect = ele.getBoundingClientRect();
      panelSizeBefore += rect[dimension];
      const CS = getCS(ele);
      // If size close to CS, set it as CS, otherwise, keep it.
      const size = rect[dimension] <= CS + 10 ? CS : rect[dimension];
      if (size === CS) {
        collapsedPanelList.push({ ele: ele, size: size });
      } else {
        expandedPanelList.push({ ele: ele, size: size });
      }
      panelSizeAfter += size; // fill parent container
    });
    console.debug(
      `Panel size: Before=${panelSizeBefore} After=${panelSizeAfter}`
    );

    /**
     * Set size of all siblings
     * Prevent the last panel left 1px caused by Math.round of the previous panel
     * Set the collapsed size first, then calculate the expanded sizes.  */
    collapsedPanelList.forEach((item) => {
      const CS = getCS(item.ele);
      item.ele.style[dimension] = `${CS}px`;
      panelSizeBefore -= CS;
      panelSizeAfter -= CS;
    });

    const ratio = panelSizeBefore / panelSizeAfter;
    console.debug("ratio:", ratio);
    for (let i = 0; i < expandedPanelList.length; i++) {
      const item = expandedPanelList[i];
      let size = 0;
      if (i < expandedPanelList.length - 1) {
        size = Math.round(item.size * ratio);
        panelSizeBefore -= size;
      } else {
        size = panelSizeBefore; // The final panel uses all the remaining space
      }
      item.ele.style[dimension] = size + "px";
      console.debug(`Set sibling [${item.ele.id}] ${item.size} -> ${size}px`);
    }
    console.groupEnd();
  };
  // ------------------------------ Write all siblings' size - END

  // ------------------------------ Modify siblings' collapsed status - START
  const setCollapseStatusOfSiblings = () => {
    setActualSizeOfSiblings();
    updateInfoOfSiblings();

    const siblingList = getSiblings();
    // console.debug("siblingList:", siblingList);
    for (let i = 0; i < siblingList.length; i++) {
      const ele = siblingList[i];
      if (isHandler(ele)) continue; //watch panels only
      const size = ele.getBoundingClientRect()[dimension];
      // console.debug("size:", size, ele.id, i);
      const CS = getCS(ele);
      changeCollapsePropertiesOfPanel(ele, size <= CS + 10 ? "add" : "remove");
    }
  };
  // ------------------------------ Modify siblings' collapsed status - END

  // ------------------------------ Store & Restore Panel Size - START
  // 👇🏻 key means whether to save the size of all panels or un-collapsed panels
  const saveAllPanelsSize = (key: string = lsKey): void => {
    console.group("💾 Save All Panel's Size, key:", key);
    for (let ele of getSiblings()) {
      if (isHandler(ele)) continue;
      if (ele.id) {
        const size = ele.getBoundingClientRect()[dimension];

        // While save the size before collapsed, don't save the collapsed size.
        if (key === lsBeforeCollapseKey) {
          const CS = getCS(ele);
          if (size < CS + 10) continue; //don't save collapsed panel
        }

        let sizeInfo: SizeObj = { [dimension]: size };
        saveSize(ele.id, sizeInfo, key);
        // console.debug(`Save Size: ele.id=${ele.id}`, sizeInfo);
      }
    }
    // console.debug(loadSize());
    console.groupEnd();
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
  console.groupEnd(); // Init end
};
// ------------------------------ Init - END

onMounted(() => {
  console.debug("🎯🎯🎯 Mounted", refHandler.value);
  // Add event/listener to handler
  initHandler(refHandler.value);
});
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
    border-left: var(--border-prev-width) solid;
    border-right: var(--border-next-width) solid;
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
    border-top: var(--border-prev-width) solid;
    border-bottom: var(--border-next-width) solid;
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

  // If both side panel are collapsed, hide btn
  &.prev-panel-collapsed.next-panel-collapsed .collapse-btn {
    display: none !important;
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
// ------------------------------ Body
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

// ------------------------------ Parent
.handler-wrapper {
  display: flex;
  & > * {
    flex-grow: 1; // The children will expand and fill the wrapper
  }
}

// ------------------------------ Panel
// Collapse panel
// Prevent size change while window size expand
// freeze class will be added by js
.panel-collapsed,
.freeze {
  flex: none !important;
  min-width: unset !important;
  min-height: unset !important;
}

// Hide collapse btn of the collapsed panel
// The handlar next to the collapsed element
.panel-collapsed + .resize-handler,
.resize-handler.prev-panel-collapsed {
  .collapse-btn.prev {
    display: none;
  }
}
// The handler prev to the collapsed element
.resize-handler:has(+ .panel-collapsed),
.resize-handler.next-panel-collapsed {
  .collapse-btn.next {
    display: none;
  }
}

.panel-collapsed {
  position: relative;

  // ------------------------------ Collapsed handler - START
  .panel-collapsed-view {
    background: #fff;
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

// Display while the panel has collapsed
.panel-collapsed-view {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  z-index: -1;
  user-select: none;
  overflow: hidden;
}

// Apply animation to the panel while collapsing and expanding.
.collapse-transition,
.expand-transition {
  transition: width var(--fadein) 0.5s, height var(--fadein) 0.5s !important;
  min-width: unset !important;
  min-height: unset !important;
}
.collapse-transition {
  --fadein: cubic-bezier(0.25, 1, 0.5, 1.1);
}
.expand-transition {
  --fadein: cubic-bezier(0.25, 1, 0.5, 1.5);
}
.drag-transition {
  transition: width 0.1s, height 0.1s;
}
</style>
