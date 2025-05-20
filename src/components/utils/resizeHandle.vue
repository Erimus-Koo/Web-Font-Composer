<!--
## 1. Resize Handle

- This is a resize handle.
- Direction could be LR(left/right) or TB(top/bottom).
- The siblings are named prev(top/left) and next(bottom/right) in code.
- The sizes of panels will be store in local storage, name `resize-handle`.


## 2. Out of this component

In order to make this component compatible with more older projects, it will 
automatically add a small amount of styles and attributes to the parent element 
and sibling elements.
- The style section begins with `<style lang="scss">`.
- Most of the JavaScript code is located in the initHandle and dragStart.

### 2.1 Body
- While dragging the handle, there is a style that prevents mouse events.

### 2.2 Parent Element
- The parent element should display as flex, and this component will set style
  of the parent element. 

### 2.3 Panel ✨
- Sibling nodes will be automatically treated as resizable panels.
- The panel must has an unique #ID to store its size 👀.
- All sibling elements in current parent must alternate between Panel and Handle,  
  e.g., Panel Handle Panel (Handle Panel)*

#### 2.3.1 Panel props
- data-min-size:        👀 number[int/str], pixel of the panel recommend min size.
- data-collpased-size:  👀 number[int/str], pixel of the panel collapsed size.
                           Default is `props.collapsedSize`
- data-non-collapsible: bool, panel can not be collapsed.
                        This attribute only works if the panel has a minimum size.

#### 2.3.2 Panel Collapsed View 🙈
- The element is only displayed when the panel is collapsed.
- Add a div with `.panel-collapsed-view` under panel.
- The default panel color is white and its size is `porps.collapsedSize`.
- You can add a customized div with `.panel-collapsed-view` to display 
  additional content, such as the names of collapsed tabs.


## Example

<div class="wrapper flex">
  <div id="panel-left" data-non-collapsible />
  <ResizeHandle />
  <div id="panel-right" data-min-size="200" data-collapsed-size="50">
    <div class="panel-content">Panel Normal Content</div>
    <div class="panel-collapsed-view">Display while collapsed</div>
  </div>
</div>
 -->
<template>
  <div
    class="resize-handle"
    v-bind="$attrs"
    :style="
      `--size:${size}px;` +
      `--border-prev-width:${Math.floor(size / 2)}px;` +
      `--border-next-width:${Math.ceil(size / 2)}px;` +
      `--hover-size:${hoverSize}px;` +
      `--color:${color};` +
      `--indicator-size:${indicatorSize}px;` +
      `--indicator-color:${indicatorColor};` +
      `--btn-color:${btnColor};` +
      `--btn-bg-color:${btnBgColor};`
    "
    ref="handleRef"
  >
    <!-- display while mouse hover & expand hover area -->
    <template v-if="isReady">
      <div class="hover-indicator">
        <!-- the collapse buttons -->
        <div v-if="hasId" class="toggle-btn prev" />
        <div v-if="hasId" class="toggle-btn next" />

        <!-- info -->
        <div v-if="showPanelInfo" class="panel-info prev" />
        <div v-if="showPanelInfo" class="panel-info next" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
const props = withDefaults(
  defineProps<{
    // normal status
    size?: number; // The width/height of handle
    hoverSize?: number; // Additional size for hover, invisible, take max val
    color?: string; // The color of handle

    // hover indicator
    indicatorSize?: number; // The width/height of indicator
    indicatorColor?: string; // The color of indicator

    // button color
    btnColor?: string; // Arrow color of collapsed btn
    btnBgColor?: string; // BG color of collapsed btn

    // collapsed handle
    collapseThreshold?: number; // Threshold for automatic panel snapping

    // adjacent elements
    collapsedSize?: number; // While collapsed, set a min size to indentify

    /** TODO: Resize Adjacent Element Only
     * The main difference is about the size limit panel
     * e.g. start=100, left panel w=200, right panel w/min-w=200, end=500
     * If true, the other panels will be frozen. The handle for moving right may appear to not work because it reaches the min-width of the right panel.
     * If false, the other panels can be resized. For instance, moving the handle from 300 to 400 will cause the left panel to expand. However, due to flex, the width may not be exact.*/
    freezeOtherPanel?: boolean;

    // show panel info
    showPanelInfo?: boolean;
  }>(),
  {
    size: 1,
    hoverSize: 10,
    color: "#333",
    indicatorSize: 2,
    indicatorColor: "#06f",
    btnColor: "#666",
    btnBgColor: "#fff9",
    collapseThreshold: 50,
    collapsedSize: 5,
    prevCollapsible: true,
    nextCollapsible: true,
    freezeOtherPanel: false,
    showPanelInfo: true,
  }
);

const handleRef = ref(); // Element
const isReady = ref(true); // Elements exist on both sides
const hasId = ref(true); // Both sides have IDs

// ------------------------------ Store size - START
const lsKey = "resize-handle"; // local storage key of panel size
const lsBeforeCollapseKey = "beforeCollapse"; // key of the size before collapse

// ------------------------------ size observer.disconnect
let disconnectObserver;

// ------------------------------ expose togglePanel - START
// Be defined first, modified inside the init, and exposed.
const togglePanel = ref(null);
// Expose to parent
defineExpose({
  togglePanel,
});
// ------------------------------ expose togglePanel - END

// ------------------------------ define types - START
// list for sibling elements
type SizeListObj = Array<{
  ele: HTMLElement;
  type: "handle" | "number";
  size: number; //Actual size (Panel or Handle)
  minSize: number; //Panel min size
  collapsedSize: number; //Panel collapsed size
  collapsible: boolean;
}>;
// ------------------------------ define types - END

// ------------------------------ utils - START
const warning = (text, obj) => {
  // play a huge warning in console
  console.warn(
    `%c[Resize Handle WARNING]: \n${text}`,
    "color: #fff; font-weight: bold; font-size: 32px; background-color: #f33; padding: 64px 16px",
    obj
  );
};

// Check if element is handle
const isHandle = (ele: HTMLElement): boolean =>
  ele && ele.classList.contains("resize-handle"); //ele might be null

// get collapsed size
const getCollapsedSize = (ele: HTMLElement): number =>
  parseInt(ele.getAttribute("data-collapsed-size") || `${props.collapsedSize}`);

// get min size
const getMinSize = (ele: HTMLElement): number =>
  parseInt(
    ele.getAttribute("data-min-size") ||
      ele.getAttribute("data-collapsed-size") ||
      `${props.collapsedSize}`
  );

const getCollapsible = (ele: HTMLElement): boolean => {
  const _NON = ele.getAttribute("data-non-collapsible");
  return !(_NON === "" || _NON?.toLowerCase() === "true");
};
// ------------------------------ utils - END

// ------------------------------ Init - START
const initHandle = (
  handle: HTMLElement // element
): void => {
  console.group("Init handle", handle);

  // -------------------- common variables
  // -------------------- elements
  let parentEle: HTMLElement;
  let prevEle: HTMLElement;
  let nextEle: HTMLElement;
  let prevInfo: HTMLElement;
  let nextInfo: HTMLElement;
  let prevHandle: HTMLElement | null; //the handle prev to the prev ele
  let nextHandle: HTMLElement | null; // the handle next to the next ele

  // -------------------- properties
  let direction: "LR" | "TB"; // LR or TB
  let dimension: "width" | "height"; // width or height
  let prevCollapsedSize: number;
  let nextCollapsedSize: number;
  let prevMinSize: number;
  let nextMinSize: number;
  let prevRect: DOMRect; // getBoundingClientRect
  let nextRect: DOMRect;

  // Define vaiables and common functions
  let start = 0; // Previous node top/left
  let end = window.innerWidth; // Next node bottom/right

  // -------------------- Drag variables
  let dragStartPoint: number;
  let prevSiblingSizeList: SizeListObj;
  let nextSiblingSizeList: SizeListObj;

  // ------------------------------ init setup for parent and siblings - START
  // Add style to parent
  parentEle = handle.parentElement as HTMLElement;
  parentEle?.classList.add("handle-wrapper");

  // Define adjacent elements
  prevEle = handle.previousElementSibling as HTMLElement;
  nextEle = handle.nextElementSibling as HTMLElement;
  if (!prevEle || !nextEle || isHandle(prevEle) || isHandle(nextEle)) {
    isReady.value = false;
    warning(`Panels are required on both sides of the handle`, {
      prevEle,
      handle,
      nextEle,
    });
    return;
  }

  prevRect = prevEle.getBoundingClientRect(); //for calc direction
  nextRect = nextEle.getBoundingClientRect(); //for calc direction
  console.debug("[init] Prev Ele:", prevEle, prevRect);
  console.debug("[init] Next Ele:", nextEle, nextRect);
  // ------------------------------ init setup for parent and siblings - START

  // Get handle of adjacent elements
  const _prevPrev = prevEle.previousElementSibling as HTMLElement;
  prevHandle = isHandle(_prevPrev) ? _prevPrev : null;
  const _nextNext = nextEle.nextElementSibling as HTMLElement;
  nextHandle = isHandle(_nextNext) ? _nextNext : null;
  console.debug("[init]Prev Handle:", prevHandle);
  console.debug("[init]Next Handle:", nextHandle);

  // Init info box
  if (props.showPanelInfo) {
    prevInfo = handle.querySelector(".panel-info.prev") as HTMLElement;
    nextInfo = handle.querySelector(".panel-info.next") as HTMLElement;
  }

  // Determine the handle direction by adjacent elements
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
    console.error("Can not determimne the direction of handle", handle);
    return;
  }
  handle.classList.add(direction);
  dimension = direction === "LR" ? "width" : "height";
  console.debug("Direction:", direction, dimension, prevRect, nextRect);

  // Check the ID of adjacent elements, no ID panel's size won't be store.
  if (!prevEle.id || !nextEle.id) {
    hasId.value = false;
    warning(`ID is required for panels on both sides of the handle`, {
      prevEle,
      handle,
      nextEle,
    });
  }

  // ------------------------------ init collapse btn status - START
  const initCollapseButtonStatus = () => {
    // Update panel collapsed btn status
    // The size might be set in em units and needs to be updated regularly.
    // ※ If the data-collapsed-size does not exist, it will be set at init.
    prevCollapsedSize = getCollapsedSize(prevEle);
    if (!getCollapsible(prevEle))
      handle
        .querySelector(".toggle-btn.prev")
        ?.classList.add("non-collapsible");
    nextCollapsedSize = getCollapsedSize(nextEle);
    if (!getCollapsible(nextEle))
      handle
        .querySelector(".toggle-btn.next")
        ?.classList.add("non-collapsible");
  };
  initCollapseButtonStatus();
  // ------------------------------ init collapse btn status - END

  // ------------------------------ Get all siblings - START
  const getSiblings = (): HTMLElement[] => {
    let siblingList: HTMLElement[] = [];
    if (!handle.parentElement) return siblingList;

    let element = handle.parentElement.firstElementChild as HTMLElement;
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
  const initCollapsedView = () => {
    getSiblings().forEach((ele) => {
      // Create view div
      if (
        !isHandle(ele) && //skip handle
        !ele.querySelector(".panel-collapsed-view") && //view existed
        !ele.classList.contains("panel-collapsed-view") //self is view
      ) {
        let collapsedPanelView = document.createElement("div");
        collapsedPanelView.classList.add("panel-collapsed-view");
        ele.appendChild(collapsedPanelView);
      }
    });
  };
  initCollapsedView();
  // ------------------------------ Create view of collapsed panels - END

  // ------------------------------ Update size of adjacent elements - START
  const updatePanelRectSize = () => {
    // Update start and end, update collapsed btn status
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
  };
  updatePanelRectSize();
  // ------------------------------ Update size of adjacent elements - END

  /**
   * ------------------------------ Write all siblings' size - START
   * Avoid flex getting wrong size due to other siblings
   * Flex automatically adjusts the size after it has been set, so setting the size one by one is not possible. For example, if the size of the first sibling is set to the current width, while the other siblings still have incorrect size properties, flex will calculate again and the size of the first sibling will change again. This process will continue for each sibling, resulting in incorrect sizes. After several iterations, the values will be very close to the correct sizes.
   * Another problem is that the handle may have a different size than props.size due to flex properties. To resolve this, we need to set the handle size to a preset value and adjust the panel size based on the remaining space.
   */
  const calcSizeOfAllPanels = () => {
    console.group("Set Actual Size of Siblings");

    const calcTotal = (list, key) =>
      list.reduce((sum, panel) => sum + panel[key], 0);

    // Get size of all siblings
    const getPanelList = () => {
      let panelList: any[] = [];
      getSiblings().forEach((ele) => {
        // ignore handle size (without flex)
        if (isHandle(ele)) return;

        const rect = ele.getBoundingClientRect();
        const currentSize = rect[dimension];

        const collapsedSize = getCollapsedSize(ele);
        const minSize = getMinSize(ele);
        const collapseable = getCollapsible(ele);

        // If size close to cs, set it as cs, otherwise, keep it.
        let idealSize = Math.round(currentSize);
        let reachMin = false;
        let isCollapsed = false;
        if (currentSize <= collapsedSize + 10 && collapseable) {
          idealSize = collapsedSize;
          reachMin = true;
          isCollapsed = true;
        } else if (currentSize <= minSize + 10) {
          idealSize = minSize;
          reachMin = true;
        }

        panelList.push({
          ele,
          currentSize,
          minSize,
          collapsedSize,
          collapseable,
          idealSize,
          reachMin,
          isCollapsed,
        });
      });
      return panelList;
    };
    let panelList = getPanelList();
    console.table(panelList);

    // Get avaliable size
    // Handles size will be changed by flex, so we need to consider them as set size.
    const getRemaningSize = () => {
      const parentSize = parentEle.getBoundingClientRect()[dimension];
      console.log("parentSize:", parentSize);
      let handleSizeTotal = 0;

      for (let ele of getSiblings()) {
        if (!isHandle(ele)) continue;

        // Ensure we correctly fetch and parse CSS variable '--size'
        // --size: 1px will be render as 0.6667px on Windows while zoom
        const computedStyle = window.getComputedStyle(ele);
        const _size =
          parseFloat(
            computedStyle.getPropertyValue("--size")?.replace("px", "").trim()
          ) || 1;

        const handleSize = ele.getBoundingClientRect()[dimension];

        console.log("handleSize(rect):", handleSize, "--size:", _size);
        handleSizeTotal += handleSize;
      }

      const availableSize = parentSize - handleSizeTotal;
      return availableSize;
    };
    // const avaliableSizeRemain = getRemaningSize();

    // TODO: test avaliable size in diff devices
    // sum size is work on Windows, both methods yield the same result on Mac.
    const avaliableSizeSum = calcTotal(panelList, "currentSize");
    // const avaliableSize = Math.min(avaliableSizeRemain, avaliableSizeSum);
    // console.log("avaliableSize:", avaliableSizeRemain, avaliableSizeSum);
    const avaliableSize = avaliableSizeSum;

    // --------------------- calc panel size - START
    const shrinkUnreachMinPanels = (panelList) => {
      console.log(">>>>> shrink <<<<<");
      // try keep unscaleable panel size, and reduce others
      const lockedPanels = panelList.filter((e) => e.reachMin);
      const lockedPanelSize = calcTotal(lockedPanels, "idealSize");
      console.log("🔰 lockedPanels | size:", lockedPanelSize);
      console.table(lockedPanels);

      const resizablePanels = panelList.filter((e) => !e.reachMin);
      const resizablePanelMinSize = calcTotal(resizablePanels, "minSize");
      console.log("🎲 resizablePanels | size:", resizablePanelMinSize);
      console.table(resizablePanels);
      if (resizablePanels.length === 0) return panelList;

      if (lockedPanelSize + resizablePanelMinSize <= avaliableSize) {
        // Entering this if means it's possible to meet layout requirements by shrinking panels that are not yet minimized.
        console.log("🎉 Shrink will satisfy the layout");
        let newSize = avaliableSize - lockedPanelSize;
        let oldSize = calcTotal(resizablePanels, "idealSize");
        const ratio = newSize / oldSize;
        console.log(`📏 old: ${oldSize} --> new: ${newSize} | ratio: ${ratio}`);
        let lastModifiedIndex: undefined | number = undefined;
        for (let i = 0; i < panelList.length; i++) {
          const panel = panelList[i];
          if (!panel.reachMin) {
            // There use floor, bacause of if use round, 2 ".5" number
            panelList[i].idealSize = Math.round(panel.idealSize * ratio);
            // Record and adjust the possible 1px error caused by the Math.round.
            newSize -= panelList[i].idealSize;
            lastModifiedIndex = i;
          }
        }
        // Adjust if there is an offset
        if (newSize != 0 && lastModifiedIndex != undefined) {
          panelList[lastModifiedIndex].idealSize += newSize;
          console.log(`🧰 Fix [${lastModifiedIndex}].idealSize += ${newSize}`);
        }
        console.table(panelList);
        //
      }
      return panelList;
    };

    const growUnreachMinPanels = (panelList, condition) => {
      console.log("<<<<< Grow >>>>>", "condition:", condition);
      const lockedPanels = panelList.filter(condition);
      const lockedPanelSize = calcTotal(lockedPanels, "idealSize");
      console.log("🔰 lockedPanels | size:", lockedPanelSize);
      console.table(lockedPanels);

      const resizablePanels = panelList.filter((e) => !condition(e));
      const resizablePanelSize = calcTotal(resizablePanels, "idealSize");
      console.log("🎲 resizablePanels | size:", resizablePanelSize);
      console.table(resizablePanels);
      if (resizablePanels.length === 0) return panelList;

      let newSize = avaliableSize - lockedPanelSize;
      let oldSize = resizablePanelSize;
      const ratio = newSize / oldSize;
      console.log(`📐 old=${oldSize} --> new=${newSize} | ratio=${ratio}`);
      let lastModifiedIndex: undefined | number = undefined;
      for (let i = 0; i < panelList.length; i++) {
        const panel = panelList[i];
        if (!panel.isCollapsed) {
          panelList[i].idealSize = Math.round(panel.idealSize * ratio);
          // Record and adjust the possible 1px error caused by the Math.round.
          newSize -= panelList[i].idealSize;
          lastModifiedIndex = i;
        }
      }
      // Adjust if there is an offset
      if (newSize != 0 && lastModifiedIndex != undefined) {
        panelList[lastModifiedIndex].idealSize += newSize;
        console.log(`🧰 Fix [${lastModifiedIndex}].idealSize += ${newSize}`);
      }
      console.table(panelList);
      return panelList;
    };

    // input panel list, try to shrink panel and return a new panel list
    const calcPanelSize = (panelList) => {
      // calc if all panels can set to ideal size
      let idealSize = calcTotal(panelList, "idealSize");
      console.log("avaliableSize:", avaliableSize, "idealSize:", idealSize);

      if (idealSize <= avaliableSize) return panelList;

      // try shrink panels that not reach min
      panelList = shrinkUnreachMinPanels(panelList);
      idealSize = calcTotal(panelList, "idealSize");
      if (idealSize <= avaliableSize) return panelList;

      // Do not have enough space, try collapse panels
      // Set all scaleable panel to min size
      for (let i = 0; i < panelList.length; i++) {
        const panel = panelList[i];
        if (!panel.reachMin) {
          panelList[i].idealSize = panel.minSize;
        }
      }

      // Try collapse panels
      let collapseSuccess = false;
      for (let i = 0; i < panelList.length; i++) {
        const panel = panelList[i];
        if (panel.collapseable && !panel.isCollapsed) {
          panelList[i].idealSize = panel.collapsedSize;
          panelList[i].isCollapsed = true;
          panelList[i].reachMin = true;

          idealSize = calcTotal(panelList, "idealSize");
          console.log("🔍 Collapsed panel:", i);
          console.table(panelList);
          if (idealSize <= avaliableSize) {
            collapseSuccess = true;
            break;
          }
        }
      }

      // Retain ideal sizes and let flex and browser handle the result
      if (!collapseSuccess) {
        console.log("🙈 Let it go");
      }
      return panelList;
    };
    panelList = calcPanelSize(panelList);

    /** After some panels are collapsed, the total ideal size may become smaller
     * than the available space. When this happens, the extra space will be applied
     * to the last panel to use up the remaining width.
     * To fix this, distribute the extra space equally among
     * the panels that are not collapsed.
     */
    if (calcTotal(panelList, "idealSize") < avaliableSize) {
      // Freeze collpased, grow minSized panels.
      const condition = (e) => e.isCollapsed;
      panelList = growUnreachMinPanels(panelList, condition);
    }
    console.log("Calc Result:");
    console.table(panelList);
    // -------------------- calc panel size - END

    // -------------------- set size to panels
    let totalSize = avaliableSize;
    for (let i = 0; i < panelList.length; i++) {
      const panel = panelList[i];
      panel.ele.style[dimension] = panel.idealSize + "px";
      console.debug(
        `Set sibling [${panel.ele.id}] ${panel.currentSize} -> ${panel.idealSize}px`
      );
    }

    console.groupEnd();
  };
  // ------------------------------ Write all siblings' size - END

  // ------------------------------ observe size change and re-calc - START
  const observeParentDimensionChanges = () => {
    if (!parentEle) return;

    // 用于存储上一次的宽度或高度
    let lastSize =
      dimension === "width" ? parentEle.offsetWidth : parentEle.offsetHeight;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Get current size
        const { width, height } = entry.contentRect;
        const currentSize = dimension === "width" ? width : height;

        console.log(`🚀 Current Size: ${currentSize} <- ${lastSize}`);

        // 比较当前值和上一次的值
        if (Math.abs(currentSize - lastSize) > 5) {
          console.log("🚨 Parent size changed");

          lastSize = currentSize; // update

          // 执行你的逻辑
          calcSizeOfAllPanels();
          setCollapseStatusOfAllPanels();
          updateInfoOfAllHandles();
          saveAllPanelsSize();
        }
      }
    });
    // 监听目标元素
    resizeObserver.observe(parentEle);

    // 返回清理函数
    return () => {
      resizeObserver.disconnect();
    };
  };
  disconnectObserver = observeParentDimensionChanges();
  // ------------------------------ observe size change and re-calc - END

  // ------------------------------ Functions after size changed - START
  // add class to panel, diterminate the collapse status of adjacent panels
  const setCollapseStatusOfPanel = (
    panelElement: HTMLElement,
    func: "add" | "remove"
  ) => {
    // this class will change the visible of collapsed view
    panelElement.classList[func]("panel-collapsed");

    // Wait for a moment; otherwise, the opposite button will appear immediately.
    setTimeout(() => {
      const prevHandleOfThis =
        panelElement.previousElementSibling as HTMLElement;
      // change the class of handles around this panel
      if (isHandle(prevHandleOfThis))
        prevHandleOfThis.classList[func]("next-panel-collapsed");
      const nextHandleOfThis = panelElement.nextElementSibling as HTMLElement;
      if (isHandle(nextHandleOfThis))
        nextHandleOfThis.classList[func]("prev-panel-collapsed");
    }, 500);
  };

  const setCollapseStatusOfAllPanels = () => {
    for (let ele of getSiblings()) {
      if (isHandle(ele)) continue; //watch panels only
      const size = ele.getBoundingClientRect()[dimension];
      // console.debug("size:", size, ele.id, i);
      const cs = getCollapsedSize(ele);
      setCollapseStatusOfPanel(ele, size <= cs + 10 ? "add" : "remove");
    }
  };

  const addTransitionToAdjacentPanel = (
    className: string,
    duration: number = 200
  ) => {
    prevEle.classList.add(className);
    nextEle.classList.add(className);
    setTimeout(() => {
      prevEle.classList.remove(className);
      nextEle.classList.remove(className);
    }, duration);
  };
  // ------------------------------ Functions after size changed - END

  // ------------------------------ Update info content - START
  const updateInfo = (ele = handle) => {
    // Update the info (panel size) of adjacent panels
    if (!isReady.value || !props.showPanelInfo) return;
    const _prevEle = ele.previousElementSibling as HTMLElement;
    const _nextEle = ele.nextElementSibling as HTMLElement;
    const _prevRect = _prevEle?.getBoundingClientRect();
    const _nextRect = _nextEle?.getBoundingClientRect();
    const _prevInfo = ele.querySelector(".panel-info.prev") as HTMLElement;
    const _nextInfo = ele.querySelector(".panel-info.next") as HTMLElement;
    _prevInfo.textContent = `${Math.round(_prevRect[dimension])}`;
    _nextInfo.textContent = `${Math.round(_nextRect[dimension])}`;
  };

  const updateInfoOfAllHandles = () => {
    for (let ele of getSiblings()) {
      if (isHandle(ele)) updateInfo(ele);
    }
  };
  // ------------------------------ Update info content - END

  // ------------------------------ Store & Restore Panel Size - START
  // SizeObj for local storage
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

  // 👇🏻 key means whether to save the size of all panels or un-collapsed panels
  const saveAllPanelsSize = (key: string = lsKey): void => {
    if (!hasId.value) return;
    console.group("💾 Save All Panel's Size, key:", key);
    for (let ele of getSiblings()) {
      if (isHandle(ele)) continue;
      if (ele.id) {
        const size = ele.getBoundingClientRect()[dimension];

        // While save the size before collapsed, don't save the collapsed size.
        if (key === lsBeforeCollapseKey) {
          const CS = getCollapsedSize(ele);
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

  const restoreAllPanelsSize = () => {
    if (!hasId.value) return;
    console.group("🍕 Restore panel size");
    for (let ele of getSiblings()) {
      if (isHandle(ele)) continue;
      const styleDict = loadSize(ele.id);
      if (!styleDict) continue;
      const size = styleDict[dimension];
      if (!size) continue;
      ele.style[dimension] = size + "px";
      console.debug("ele:", ele.id, size);
    }

    // Wait for the panel to be resized by flex
    setTimeout(() => {
      calcSizeOfAllPanels();
      setCollapseStatusOfAllPanels();
      updateInfoOfAllHandles();
      saveAllPanelsSize();
    }, 500);
    console.groupEnd();
  };
  restoreAllPanelsSize();
  // ------------------------------ Store & Restore Panel Size - END

  // ------------------------------ Push Panel - START
  const initStatusForPushPanel = () => {
    // init panel status for changing (drag or expand)
    const allSiblingSizeList: SizeListObj = getSiblings().map((ele) => ({
      ele: ele,
      type: isHandle(ele) ? "handle" : "panel",
      size: ele.getBoundingClientRect()[dimension],
      minSize: getMinSize(ele),
      collapsedSize: getCollapsedSize(ele),
      collapsible: getCollapsible(ele),
    })) as SizeListObj;
    const thisIdx = getSiblings().indexOf(handle);
    prevSiblingSizeList = allSiblingSizeList.slice(0, thisIdx).reverse();
    nextSiblingSizeList = allSiblingSizeList.slice(thisIdx + 1);

    // If end - start < prevMin + nextMin,
    // or the start state size less than min size, ignore min size.
    const _prevEle = prevSiblingSizeList[0];
    const _nextEle = nextSiblingSizeList[0];
    const totalSizeLtMinSize =
      _prevEle.size + _nextEle.size < _prevEle.minSize + _nextEle.minSize;
    const prevSizeLtMinSize = _prevEle.size < _prevEle.minSize;
    const nextSizeLtMinSize = _nextEle.size < _nextEle.minSize;
    if ((prevSizeLtMinSize || totalSizeLtMinSize) && _prevEle.collapsible) {
      prevSiblingSizeList[0].minSize = _prevEle.collapsedSize;
    }
    if ((nextSizeLtMinSize || totalSizeLtMinSize) && _nextEle.collapsible) {
      nextSiblingSizeList[0].minSize = _nextEle.collapsedSize;
    }

    dragStartPoint =
      handle.getBoundingClientRect()[direction === "LR" ? "x" : "y"] +
      props.size / 2;

    console.debug(
      `Drag start point=${dragStartPoint} | Index=${thisIdx} | ` +
        `\nSibling Size List:`,
      prevSiblingSizeList,
      nextSiblingSizeList
    );
  };

  const pushPanels = (
    to: "prev" | "next",
    distance: number //Handle move distance
  ) => {
    /** Calculate the new size of siblings and set the size
     * Read the draw.io graph in doc folder for more details
     */
    console.group("Push Panel:", to, distance);

    let _siblingSizeList: SizeListObj = (
      to === "prev" ? prevSiblingSizeList : nextSiblingSizeList
    ) as SizeListObj;

    // Calc opposite panel size
    let fixedDistance = distance;
    // Element on the other side
    let opEle = to === "next" ? prevSiblingSizeList[0] : nextSiblingSizeList[0];
    const opMinSize = getMinSize(opEle.ele) || getCollapsedSize(opEle.ele);
    const minMove = opMinSize - opEle.size;
    if (distance < minMove - props.collapseThreshold) {
      fixedDistance = 0; // cancel move while smaller than the min size
    } else if (distance < minMove) {
      fixedDistance = minMove; // snap to the min size
    }
    // Calculate panel size
    let sizeList: { ele: HTMLElement; oldSize: number; newSize: number }[] = [];
    let _start = fixedDistance; //Offset at start
    let _end = 0; //Total end of before
    let virtualEnd = fixedDistance; //Total end of after
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

      if (item.type === "handle") {
        console.debug(`🔵 Handle ${item.ele.id}`);
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
      sizeList.push({ ele: item.ele, oldSize: size, newSize: newSize });
      _start += newSize;
      virtualEnd += newSize;
      console.debug(
        `end=${_end} virtualEnd=${virtualEnd} offset=${_end - virtualEnd} ` +
          `oldSize=${size} newSize=${newSize} stop=${stopPropagation}`
      );

      setCollapseStatusOfPanel(item.ele, newSize === cs ? "add" : "remove");

      if (stopPropagation) break;
    }
    let offset = _end - virtualEnd;
    console.debug(
      `🚩to:${to} distance:${distance} offset:${offset}\n` + `sizeList:`,
      sizeList
    );
    console.groupEnd();

    // Set value of [to] _siblingSizeList
    sizeList.forEach((item) => {
      item.ele.style[dimension] = `${item.newSize}px`;
      console.debug(`${item.ele.id} ${item.oldSize} ${item.newSize}`);
    });

    // Get old size of the element on the other side
    const opNewSize = opEle.size + fixedDistance + offset;
    opEle.ele.style[dimension] = `${opNewSize}px`;
    setCollapseStatusOfPanel(
      opEle.ele,
      opNewSize === opEle.collapsedSize ? "add" : "remove"
    );
    console.debug(
      `Opposite Ele: ${opEle.size} -> ${opNewSize} (${opNewSize - opEle.size})`
    );
  };
  // ------------------------------ Push Panel - END

  // ------------------------------ Collapse & Expand Panel - START
  const collapsePanel = (collapseDirection: "prev" | "next") => {
    // Store the size of expand status
    saveAllPanelsSize(lsBeforeCollapseKey);

    // targetEle = Which panel will be collapsed
    const targetEle = collapseDirection === "prev" ? prevEle : nextEle;
    const anotherEle = collapseDirection === "next" ? prevEle : nextEle;

    updatePanelRectSize();
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

    // After changes (collapsed view fade in)
    setCollapseStatusOfPanel(targetEle, "add");
  };

  const expandPanel = (expandTo: "prev" | "next"): void => {
    // targetEle = Which panel will be expanded
    const targetEle = expandTo === "prev" ? nextEle : prevEle;
    const anotherEle = expandTo === "next" ? nextEle : prevEle;

    updatePanelRectSize();
    const fullSize = end - start - props.size;

    // Read current size
    const currentSize =
      targetEle[direction == "LR" ? "clientWidth" : "clientHeight"]; //

    // Read stored size
    const storedSize = loadSize(targetEle.id, lsBeforeCollapseKey)[dimension];

    // Calculate distance (new size - old size)
    let distance = fullSize / 2;
    if (storedSize) {
      distance = Math.max(storedSize, getMinSize(targetEle)) - currentSize;
    }

    console.debug(
      `🍉 start:${start} end:${end} end-start:${end - start} ` +
        `full:${fullSize} storedSize:${storedSize} currentSize:${currentSize} ` +
        `expandTo:${expandTo} distance:${distance}`
    );

    // Use push panel
    initStatusForPushPanel();
    pushPanels(expandTo, distance);

    // After changes (collapsed view fade out)
    setCollapseStatusOfPanel(targetEle, "remove");
  };
  // ------------------------------ Collapse & Expand Panel - END

  // -------------------- Click Btn - START
  const clickCollapseBtn = (e: Event): void => {
    const btnEle = e.target as Element;
    console.debug("🎈 Collapse Btn", e, btnEle.classList);
    e.stopPropagation();

    // Get direction
    const btnDirection = btnEle.classList.contains("prev") ? "prev" : "next";
    console.debug("Collapse btn direction:", btnDirection);

    updatePanelRectSize();
    console.debug(
      `Size: Prev=${prevRect[dimension]} | Next=${nextRect[dimension]}`,
      prevRect,
      nextRect
    );

    // Collapse or Expand, 10 is the thresholds
    if (
      prevRect[dimension] < prevCollapsedSize + 10 ||
      nextRect[dimension] < nextCollapsedSize + 10
    ) {
      togglePanel.value("expand", btnDirection);
    } else {
      console.debug(`✅ Collapse -> ${btnDirection}`); // collapse --------------------
      togglePanel.value("collapse", btnDirection);
    }
  };

  togglePanel.value = (
    action: "expand" | "collapse",
    direction: "prev" | "next"
  ) => {
    console.log("Toggle Panel:", action, direction);
    const transitionDuration = 1000;

    updatePanelRectSize();

    // Collapse or Expand, 10 is the thresholds
    if (action == "expand") {
      console.debug(`✅ Expand -> ${direction}`); // expand --------------------
      expandPanel(direction);
      addTransitionToAdjacentPanel("expand-transition", transitionDuration);
    } else {
      console.debug(`✅ Collapse -> ${direction}`); // collapse --------------------
      collapsePanel(direction);
      addTransitionToAdjacentPanel("collapse-transition", transitionDuration);
    }

    setTimeout(() => {
      /**
       * If the :has selector is used, the previous configuration is sufficient.
       * Handle preceding the collapsed ele is .resize-handle:has(+ .collapsed)
       * However, to ensure compatibility with older browsers,
       * it's necessary to add a class to the elements preceding the handle.*/
      setCollapseStatusOfAllPanels();
      updateInfoOfAllHandles();
      saveAllPanelsSize();
    }, transitionDuration);
  };

  // add listener to collapse btn
  handle.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", clickCollapseBtn);
  });

  // -------------------- Click Btn - END

  // -------------------- Drag start - START
  const dragStart = () => {
    console.debug("🔫 Drag Start");

    // Prevent text be selected while mouse move
    document.body.classList.add("body-on-dragging");
    document.body.classList.add(direction);
    handle.classList.add("dragging");

    // Store panel size (if dragged to collapsed, store it for expanding)
    saveAllPanelsSize(lsBeforeCollapseKey);

    // Prepare for move
    initStatusForPushPanel();

    // -------------------- Drag move - START
    const dragMove = (e: MouseEvent | TouchEvent) => {
      // Calculate siblings' size
      // console.debug("e.type:", e.type, e);
      const _src: MouseEvent | Touch =
        e.type === "mousemove"
          ? (e as MouseEvent)
          : (e as TouchEvent).touches[0];
      const current = direction === "LR" ? _src.clientX : _src.clientY;
      const to = current > dragStartPoint ? "next" : "prev";

      const maxLimit =
        direction === "LR" ? window.innerWidth : window.innerHeight;

      const moveDistance = Math.round(Math.abs(current - dragStartPoint));

      //if no move > 1px, or current out of the window, don't calc
      if (moveDistance === 0 || current < 0 || current > maxLimit) return;

      // calc and move panels
      pushPanels(to, moveDistance);

      // update info for current handle
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
      handle.classList.remove("dragging");

      // After size changed actions
      setCollapseStatusOfAllPanels();
      updateInfoOfAllHandles();
      saveAllPanelsSize();
    };
    document.onmouseup = dragEnd;
    document.ontouchend = dragEnd;
    window.onfocus = dragEnd; // Reset while the window is switched back
    // -------------------- Drag end - END
  };

  handle.onmousedown = dragStart;
  handle.ontouchstart = dragStart;
  // -------------------- Drag start - END

  console.groupEnd(); // Init end
};
// ------------------------------ Init - END

onMounted(() => {
  console.debug("🎯🎯🎯 Mounted", handleRef.value);
  // Add event/listener to handle
  initHandle(handleRef.value);
});

// 保存清理函数以便在组件卸载时执行
onBeforeUnmount(() => {
  disconnectObserver && disconnectObserver();
});
</script>

<style lang="scss" scoped>
.resize-handle {
  // For child element
  position: relative;
  z-index: 99;
  box-sizing: border-box;
  display: flex;
  flex: none !important;
  align-items: center;
  justify-content: center;
  color: var(--color);

  // .hover-indicator (hover status)
  .hover-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--indicator-color);
    opacity: 0;

    // opacity: 0.5; //debug
    transition: opacity 0.5s;

    &,
    &::after {
      position: absolute; // bigger size than parent
      width: 100%;
      height: 100%;
    }

    // Invisible hoverable area
    &::after {
      z-index: -1;
      display: block;
      content: "";

      // background: #0f09; //debug
      transition: width 0.2s, height 0.2s;
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
   * Handle of LR
   * Directly set width/height will cause 1px expand to 1.5px on windows,
   * which will appear as 2px. To maintain a 1px appearance, use border here.
   * If the size is an odd number, right/bottom has higher priority.
   */
  &.LR {
    flex-direction: row; // for prev/next align setting
    cursor: ew-resize;
    border-right: var(--border-next-width) solid;
    border-left: var(--border-prev-width) solid;

    .hover-indicator {
      flex-direction: row; // for prev/next align setting
      width: var(--indicator-size);

      &::after {
        width: max(var(--size), var(--hover-size)); // hover area
      }
    }
  }

  // Handle of TB
  &.TB {
    flex-direction: column; // for prev/next align setting
    cursor: ns-resize;
    border-top: var(--border-prev-width) solid;
    border-bottom: var(--border-next-width) solid;

    .hover-indicator {
      flex-direction: column; // for prev/next align setting
      height: var(--indicator-size);

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

  .toggle-btn {
    position: absolute;
    z-index: -1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--gap);
    cursor: pointer;
    opacity: 0; //product
    transform: scale(0); //product
    // border: 1px solid red; //debug
    // opacity: 0.5; //debug
    // transform: scale(1); //debug
    transition: opacity 0.5s, transform var(--fadeout) 0.5s;

    // before = background, after = arrow
    &::before,
    &::after {
      display: block;
      content: "";
    }

    &::before {
      z-index: -1;
      box-sizing: border-box;

      // position: absolute;
      background: var(--btn-bg-color, "#fff9");

      // border: 1px solid;
      border-radius: 0.5rem;
      box-shadow: 0 0 var(--gap) #0003;
      backdrop-filter: blur(0.125rem);
      transition: box-shadow 0.3s;
    }

    &::after {
      position: absolute;
      color: var(--btn-color, #666);
      transition: color 0.3s;
    }

    &:hover {
      &::before {
        box-shadow: 0 0 var(--gap) var(--indicator-color);
      }

      &::after {
        color: var(--indicator-color);
      }
    }

    &.non-collapsible {
      display: none;
    }
  }

  &.LR .toggle-btn {
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

  &.TB .toggle-btn {
    left: calc(50% - var(--edge-l) / 2 - var(--gap));

    &::before {
      width: var(--edge-l);
      height: var(--edge-s);
    }

    &::after {
      border-right: var(--arrow) solid transparent;
      border-left: var(--arrow) solid transparent;
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

  // When the handle is hovered over, the collapse button appears
  &:hover .toggle-btn {
    opacity: 1;
    transform: scale(1) !important;

    // Transition delay, avoid the btn appearing while cursor is passing over
    transition: opacity 0.2s 0.3s, transform 0.2s var(--fadein) 0.3s;
  }

  // Maintain a small size while collapsed for easy activation.
  &.prev-panel-collapsed .toggle-btn.next,
  &.next-panel-collapsed .toggle-btn.prev {
    display: flex !important; // non-collapsible btn, should allow for expand
    transform: scale(0.5);
  }

  // If the handle is already collapsed, there's no need for a delay
  &.prev-panel-collapsed,
  &.next-panel-collapsed {
    &:hover .toggle-btn {
      transition: opacity 0.2s, transform 0.2s var(--fadein);
    }
  }

  // If both side panel are collapsed, hide btn
  &.prev-panel-collapsed.next-panel-collapsed .toggle-btn {
    display: none !important;
  }

  // ------------------------------ Collapse Button - END

  // ------------------------------ Info box - START
  .panel-info {
    position: absolute;
    z-index: -2;
    height: var(--edge-s);
    padding: 0 var(--gap);
    margin: var(--gap);
    font-family: monospace;
    font-size: clamp(10px, 0.75rem, 14px);
    line-height: var(--edge-s);
    color: #fff;
    background: #3339;
    border-radius: 1rem;
    opacity: 0;
    transform: scale(0);

    // opacity: 0.5; //debug
    // transform: scale(1); //debug
    transition: opacity 0.2s, transform 0.2s var(--fadeout);
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
.handle-wrapper {
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
// The handle next to the collapsed element
.panel-collapsed + .resize-handle,
.resize-handle.prev-panel-collapsed {
  .toggle-btn.prev {
    display: none;
  }
}

// The handle prev to the collapsed element
.resize-handle:has(+ .panel-collapsed),
.resize-handle.next-panel-collapsed {
  .toggle-btn.next {
    display: none;
  }
}

// Display while the panel has collapsed
.panel-collapsed-view {
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  opacity: 0;
}

.panel-collapsed {
  position: relative;

  // ------------------------------ Collapsed handle - START
  .panel-collapsed-view {
    z-index: 99;
    user-select: auto;
    background: #fff;
    opacity: 1;
    transition: opacity 0.5s;
  }

  // ------------------------------ Collapsed handle - END

  // The hanlder of sub-panel, which parent panel is collapsed.
  .resize-handle {
    display: none;
  }
}

// Apply animation to the panel while collapsing and expanding.
.collapse-transition,
.expand-transition {
  min-width: unset !important;
  min-height: unset !important;
  transition: width var(--fadein) 0.5s, height var(--fadein) 0.5s !important;
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
