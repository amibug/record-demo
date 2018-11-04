import { addNode, removeNodeAttr, initDom, getIdByElement } from './tools/v-dom';
import { init as initData, addChange, confirm, uploadScreenshot } from '../service';
import { setTimeout } from 'timers';
import store from '../store';
import { _throttle } from '../help/util';

let running = false; // 是否运行中
let expireTimer = null; // 超时重启
const EXPIRE_TIME = 20 * 60 * 1000; // 最多20分钟

const log = (msg) => {
  // console.log(`[insights recorder] ${msg}`);
}

const MUTATION_PLAIN_KEYS = ['type', 'attributeName', 'oldValue'];
const MUTATION_SINGLE_NODE_KEYS = ['previousSibling', 'nextSibling'];
const MUTATION_NODE_LIST_KEYS = ['addedNodes', 'removedNodes'];

function getNodesWithOutScript(nodes) {
  return Array.prototype.filter.call(nodes, node => node.tagName !== 'SCRIPT');
}

function transformMutation(mutation) {
  const { type, target, previousSibling, nextSibling, ...others } = mutation;
  let { addedNodes = [], removedNodes = [] } = mutation;
  // 去除script
  if (target && target.tagName) {
    if (target.tagName === 'SCRIPT') {
      return null;
    }
  }
  const data = {
    // type,
    // t: 时间data模块自动加上,
    // ...others
  };
  if (type !== 'characterData') {
    data.target = getIdByElement(target);
    // console.log(type + '-' + data.target, mutation);
  }
  MUTATION_PLAIN_KEYS.forEach((key) => {
    if (mutation[key]) {
      data[key] = mutation[key];
    }
  });
  MUTATION_SINGLE_NODE_KEYS.forEach((key) => {
    const node = mutation[key];
    if (node !== null) {
      data[key] = getIdByElement(node);
    }
  });
  MUTATION_NODE_LIST_KEYS.forEach((key) => {
    const nodes = getNodesWithOutScript(mutation[key]);
    if (nodes && nodes.length > 0) {
      data[key] = Array.prototype.map.call(nodes, (node) => {
        const nodeData = {};
        // 注释节点直接忽视
        if (node.nodeName === '#comment') {
          return {
            ignore: true,
          };
        }
        if (node.parentElement) {
          nodeData.parent = getIdByElement(node.parentElement);
          nodeData.index = Array.prototype.indexOf.call(node.parentElement.childNodes, node);
        }
        if (key === 'addedNodes') {
          nodeData.html = addNode(node);
          if (nodeData.index === -1) {
            nodeData.html = node.nodeValue;
          }
          removeNodeAttr(node);
        } else {
          nodeData.id = getIdByElement(node);
        }
        // 文本节点保存html
        if (node.nodeName === '#text') {
          nodeData.type = '#text';
          nodeData.html = node.nodeValue;
          if (!nodeData.parent) {
            nodeData.parent = getIdByElement(target);
          }
          // if(key === 'removedNodes') console.log(nodeData, target);
        }
        return nodeData;
      });
      data[key] = data[key].filter(node => node.ignore !== true);
    }
  });
  // edge cases
  if (type === 'attributes') {
    const { attributeName } = mutation;
    if (attributeName === 'data-uuid') {
      return false;
    }
    data.attributeName = attributeName;
    data.attributeValue = target.getAttribute(attributeName);
  } else if (type === 'characterData') {
    if (target.parentElement) {
      data.parent = getIdByElement(target.parentElement);
      data.html = target.parentElement.innerHTML;
      // console.log(3333, target.parentElement, data.parent, data.html);
    }
  } else if (type === 'childList') {
    // nothing
  }
  return data;
}

// start可多次调用 但不能在running状态下
export function start() {
  if (running) {
    log('try to start while running!');
    return;
  }
  const promise = listenDomMutations();
  listenOperations();
  // expireTimer = setTimeout(() => {
  //   end({
  //     needUpload: false,
  //   });
  // }, EXPIRE_TIME);
  running = true;
  return promise;
}

let observer = null;
// 记录dom操作
function listenDomMutations() {
  // log('dom listening!');
  const readyDom = initDom();
  const MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
  observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      const change = transformMutation(mutation);
      if (change) {
        addChange(change);
      }
    });
  });
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  });
  return initData(readyDom);
}

// 记录操作
let lastRecord = 0;
const recordGap = 100;
const listeners = [];

function addListener(target, event, func, options) {
  target.addEventListener(event, func, options);
  listeners.push({
    target,
    event,
    listener: func
  });
}

// MDN推荐的scrollXY获取方式，兼容性好
function getScrollXY() {
  const supportPageOffset = window.pageXOffset !== undefined;
  const isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");

  const x = supportPageOffset ? window.pageXOffset : isCSS1Compat ? document.documentElement.scrollLeft : document.body.scrollLeft;
  const y = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;
  return { x, y };
}

function listenOperations() {
  // 监听onscroll 目前只记录了顶级元素
  // 18.8.27 支持局部滚动 @布澜
  function scrollListener(e) {
    const { target } = e;
    if (target === document) {
      const { x: scrollLeft, y: scrollTop } = getScrollXY();
      addChange({
        type: 'scroll',
        x: scrollLeft,
        y: scrollTop,
      });
    } else {
      const id = getIdByElement(target);
      if (id) {
        addChange({
          type: 'scroll',
          target: id,
          x: target.scrollLeft,
          y: target.scrollTop,
        });
      }
    }
  }
  scrollListener({
    target: document,
  });
  addListener(document, 'scroll', _throttle(scrollListener, recordGap), true);

  // 记录鼠标move
  function moveListener (e) {
    const { pageX, pageY } = e;
    addChange({
      type: 'move',
      x: pageX,
      y: pageY
    });
  }
  addListener(document, 'mousemove', _throttle(moveListener, recordGap));

  // 全量记录点击
  function clickListener (e) {
    const { pageX, pageY } = e;
    addChange({
      type: 'click',
      x: pageX,
      y: pageY
    })
  }
  addListener(document, 'click', clickListener);

  // 全量记录viewport
  const onResize = () => {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    addChange({
      type: 'viewport',
      w,
      h
    })
  }
  onResize();
  addListener(window, 'resize', onResize);

  const KEY_MAP = {
    radio: 'checked',
    checkbox: 'checked',
  };

  // 全量记录表单元素
  function formEleListener(e) {
    const { target } = e;
    const id = getIdByElement(target);
    if (id) {
      const key = KEY_MAP[target.type];
      if (key) {
        addChange({
          type: 'form',
          target: id,
          k: key,
          v: target[key],
        });
      } else {
        addChange({
          type: 'form',
          target: id,
          v: target.value,
        });
      }
    }
  }
  addListener(document, 'change', formEleListener, true);
}

// 全量记录错误
function errorListener(e) {
  // console.log('error---------------\n', e);
  const { message, source, lineno, colno } = e;
  addChange({
    type: 'jserror',
    message, source, lineno, colno
  });
}
addListener(window, 'error', errorListener);

export function end(params = {}) {
  const isRecording = store.get('isRecording');
  if (isRecording && !running) {
    console.warn('already stopped!');
    return;
  }
  const {
    async = true,
    needUpload = true,
    uploadParams = {},
  } = params;

  if (isRecording) {
    endAll();
  }
  if (!needUpload) {
    running = false;
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  function endAll() {
    running = false;
    // timer
    if (expireTimer) {
      clearTimeout(expireTimer);
      expireTimer = null;
    }
    // mutationObserver
    observer.disconnect();
    observer = null;
    // remove listeners
    listeners.forEach(({ target, event, listener }) => {
      target.removeEventListener(event, listener);
    })
  }

  if (needUpload) {
    return new Promise((resolve, reject) => {
      confirm(uploadParams, { async }).then((res) => {
        running = false;
        resolve(res);
      }).catch((e) => { reject(); });
    });
  }
}
