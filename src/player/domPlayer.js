import { initDom as connectDom, addNode, getIdByElement, getElementById } from './v-dom';
import { setInterval, clearInterval } from "timers";

let replayID, recordData, iDocument;
let playedTime = 0;
let startPlayTime = 0;
const frameInterval = 60; // 帧间隔ms
const IdPrefix = '__insights__-';
const SHOW_OPERATION = false;

let playerframe, opLayer, scrollLayer, mouseCanvas, pageContainer, mouse, timer, _onTimeChange;
let domWidth, domHeight;
let lastX, lastY;

function onresize() {
  const pWidth = pageContainer.parentNode.clientWidth;
  const pHeight = pageContainer.parentNode.clientHeight;
  const wRatio = pWidth / domWidth;
  const hRatio = pHeight / domHeight;
  const ratio = Math.min(wRatio, hRatio);
  pageContainer.style.left = `${(pWidth - domWidth * ratio) / 2}px`;
  pageContainer.style.top = `${(pHeight - domHeight * ratio) / 2}px`;
  pageContainer.style.transform = `scale(${ratio})`;
}

export function init(params) {
  const { data, domContainer, onTimeChange } = params;
  _onTimeChange = onTimeChange;
  recordData = data;
  window.onresize = onresize;
  domContainer.innerHTML = '';
  domContainer.appendChild(html(`
    <div class="player" id="${IdPrefix}page-container">
      <div class="operation-layer" id="${IdPrefix}operation-layer">
        <div id="${IdPrefix}mouse"></div>
        <div id="${IdPrefix}scroller"></div>
        <canvas id="${IdPrefix}canvas" />
      </div>
      <iframe sandbox="allow-forms allow-same-origin" src="about:blank" frameborder="0" id="${IdPrefix}player-frame"></iframe>
    </div>
  `));

  const getEleById = id => document.getElementById(`${IdPrefix}${id}`);
  playerframe = getEleById('player-frame');
  opLayer = getEleById('operation-layer');
  pageContainer = getEleById('page-container');
  mouse = getEleById('mouse');
  scrollLayer = getEleById('scroller');
  mouseCanvas = getEleById('canvas');
  // timer = null;
  initDom();
}

export function getTime() {
  return playedTime;
}

export function pause() {
  clearInterval(timer);
}

export function play() {
  timer = setInterval(frame, frameInterval);
}

export function jump(t) {
  pause();
  playedTime = 0;
  const { mutations } = recordData;
  mutations.forEach(change => {
    change.played = false;
  });
  // 从头放过去
  initDom().then(() => {
    frame(t);
  });
  // play();
}

function initDom() {
  if (!recordData) {
    return;
  }
  window.__getInnerDocument = (document) => {
    iDocument = document;
  };

  // wipe scroll player
  scrollLayer.innerHTML = '';
  // mouse canvas
  mouseCanvas.getContext('2d').clearRect(0, 0, mouseCanvas.width, mouseCanvas.height);
  lastX = undefined;
  lastY = undefined;
  // ready dom
  const { readyDom } = recordData;
  const _initDom = readyDom.replace(/charset=\"gbk\"/, 'charset="utf-8"'); // 临时解决

  return new Promise((resolve, reject) => {
    playerframe.onload = () => {
      iDocument = playerframe.contentWindow.document;
      iDocument.scrollingElement.scrollTop = 0;
      iDocument.scrollingElement.scrollLeft = 0;
      window.iDocument = iDocument;
      iDocument.close();
      window.iDocument = iDocument;
      iDocument.write(`<!DOCTYPE html>${_initDom}`);
      connectDom(iDocument);
      resolve();

      let initDomTimes = 0;
      const initDomInterval = setInterval(() => {
        connectDom(iDocument);
        initDomTimes += 1;
        if (initDomTimes >= 10) {
          clearInterval(initDomInterval);
        }
      }, 100);
    };
    playerframe.src = 'about:blank';
  });
}

function frame(t) {
  playedTime += t || frameInterval;
  const { mutations } = recordData;
  const allPlayed = mutations[mutations.length - 1].played === true;
  if (allPlayed) {
    return;
  }
  _onTimeChange(playedTime);
  // dom changes
  const currentFrameChanges = [];
  for (let i = 0; i < mutations.length; i++) {
    const change = mutations[i];
    if (change.t > playedTime) {
      break;
    }
    if (change.played !== true) {
      currentFrameChanges.push(change);
    }
  }
  currentFrameChanges.sort((a, b) => a.t - b.t).forEach(applyChange);
}

function applyChange(change) {
  change.played = true;
  const { type, target: targetId = null } = change;
  const mouseCanvasCtx = mouseCanvas.getContext('2d');

  const nodeTypes = ['childList', 'characterData', 'attributes'];
  if (nodeTypes.indexOf(type) === -1) {
    // operations
    if (type === 'click') {
      const div = document.createElement('div');
      div.style = 'position: absolute;width: 10px;height: 10px;border-radius:50%;background-color: red;z-index:1;margin-left: -5px;margin-top: -5px;';
      div.style.top = `${change.y}px`;
      div.style.left = `${change.x}px`;
      scrollLayer.appendChild(div);
    } else if (type === 'move') {
      mouse.style.top = `${change.y}px`;
      mouse.style.left = `${change.x}px`;
      // canvas
      pencil(mouseCanvasCtx, change.x, change.y, lastX, lastY);
      lastX = change.x;
      lastY = change.y;
    } else if (type === 'scroll') {
      const { x, y, target } = change;
      if (target) {
        const ele = getElementById(target);
        if (ele) {
          ele.scrollTop = y;
          ele.scrollLeft = x;
        }
      } else {
        iDocument.scrollingElement.scrollTop = y;
        iDocument.scrollingElement.scrollLeft = x;
        opLayer.scrollTop = y;
        opLayer.scrollLeft = x;
      }
      // trigger move
      // mouse.style.top = `${parseInt(mouse.style.top) + y}px`;
      // mouse.style.left = `${parseInt(mouse.style.left) + x}px`;
    } else if (type === 'viewport') {
      pageContainer.style.width = `${change.w}px`;
      pageContainer.style.height = `${change.h}px`;
      domWidth = change.w;
      domHeight = change.h;
      mouseCanvas.width = change.w;
      mouseCanvas.height = 10000;
      onresize();
    } else if (type === 'form') {
      const { k = 'value', v, target } = change;
      const ele = target && getElementById(target);
      if (ele) {
        ele[k] = v;
      }
    }
    return;
  }

  if (!targetId && type !== 'characterData') {
    // console.log('no target id', target, change);
    return;
  }
  let target = getElementById(targetId);
  if (!target) {
    if (type !== 'characterData') {
      // 9.12 奇怪的问题，readyDom加载的时候，head上的uuid会丢掉
      target = iDocument.head;
    }
  }

  // attributes childList characterData
  if (type === 'childList') {
    const { addedNodes = [], removedNodes = [], innerHTML } = change;
    if (target && innerHTML) {
      target.innerHTML = innerHTML;
      return;
    }
    // 删除
    removedNodes.forEach((item) => {
      const { id, html: outerHTML, parent, type: eleType } = item;
      // text节点
      if (eleType === '#text') {
        if (parent) {
          const parentNode = getElementById(parent);
          if (parentNode) {
            const { childNodes } = parentNode;
            for (let i = 0; i < childNodes.length; i += 1) {
              const child = childNodes[i];
              if (child.nodeName === '#text' && child.nodeValue === outerHTML) {
                parentNode.removeChild(child);
                break;
              }
            }
          }
        }
        return;
      }
      if (!id) {
        return;
      }
      const removed = getElementById(id);
      try {
        if (parent) {
          const parentNode = getElementById(parent);
          if (parentNode) {
            parentNode.removeChild(removed);
          } else {
            target.removeChild(removed);
          }
        } else {
          target.removeChild(removed);
        }
      } catch (e) {
        if (removed && removed.parent) {
          removed.parent.removeChild(removed);
        }
      }
    });
    // 添加
    addedNodes.forEach((item) => {
      const { html: outerHTML, index, type: eleType } = item;
      if (eleType === '#text') {
        try {
          target.insertBefore(new Text(outerHTML), target.childNodes[index]);
        } catch (e) { target.appendChild(new Text(outerHTML)); }
        return;
      }
      const ele = html(outerHTML);
      try {
        if (ele && ele.getAttribute) {
          const newEleId = ele.getAttribute('data-uuid');
          if (newEleId && target && target.innerHTML && target.innerHTML.indexOf(newEleId) > -1) {
            // 重复id不作重复插入
            return;
          }
        }
        if (parseInt(index, 10) === -1) {
          // 未取到index的情况，兼容放最后
          target.appendChild(ele);
        } else {
          if (index === undefined || index < 0) {
            target.appendChild(ele);
          } else {
            target.insertBefore(ele, target.childNodes[index]);
          }
          addNode(ele);
        }
      } catch (e) {
        try {
          // text node fix
          target.appendChild(ele);
          addNode(ele);
        } catch (err) { /* do nothing */ }
      }
    });
  } else if (type === 'attributes') {
    const { attributeName, attributeValue } = change;
    if (attributeName && attributeValue) {
      target.setAttribute(attributeName, attributeValue);
    }
  } else if (type === 'characterData') {
    const { parent, html: outerHTML } = change;
    const parentNode = getElementById(parent);
    if (outerHTML.indexOf('</') === -1) { // 修复奇怪的html覆盖的情况
      parentNode.innerHTML = outerHTML;
    }
  }
}

const tagParentMap = {
  tr: 'tbody',
  td: 'tr',
  th: 'tr',
  col: 'colgroup',
  colgroup: 'table',
  thead: 'table',
  tbody: 'table',
};
function html(text) {
  // fix table problem 2018.7.9 bulan
  const s = /^<(\S+)\s*?([\s\S]*?)>([\s\S]*?)<\/(\w*?)>$/g.exec(text);
  let parentTagName = 'div';
  if (s && s[1]) {
    const tagName = s[1];
    parentTagName = tagParentMap[tagName] || 'div';
  }

  const div = document.createElement(parentTagName);
  div.innerHTML = text;
  return div.children[0];
}

function pencil(ctx, x, y, _lastX, _lastY) {
  if (!_lastX || !_lastY) {
    return;
  }
  // 画线
  ctx.strokeStyle = 'rgba(255, 115, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(_lastX || x - 1, _lastY || y - 1); // 设置起点
  ctx.lineTo(x, y); // 画线
  ctx.closePath();
  ctx.stroke();
}
