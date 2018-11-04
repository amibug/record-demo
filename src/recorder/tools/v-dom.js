const domIdMap = new Map();
let readyDom = '';

const ATTRIBUTE_KEY = 'data-uuid';

export function addNode(node) {
  let id = uuid();
  if (node.setAttribute) {
    if (domIdMap.get(node)) {
      id = domIdMap.get(node);
    }
    domIdMap.set(node, id);
    node.setAttribute(ATTRIBUTE_KEY, id);
  }
  if (node.children && node.children.length > 0) {
    Array.prototype.forEach.call(node.children, addNode);
  }
  return node.outerHTML;
}

export function removeNodeAttr(node) {
  if (node.removeAttribute) {
    node.removeAttribute(ATTRIBUTE_KEY);
  }  
  if (node.children && node.children.length > 0) {
    Array.prototype.forEach.call(node.children, removeNodeAttr);
  }
}

export function initDom() {
  // console.time('[v-dom] initDomMap');
  Array.prototype.forEach.call(document.all, (node) => {
    if (node.setAttribute) {
      let id = uuid();
      if (domIdMap.get(node)) {
        id = domIdMap.get(node);
      }
      domIdMap.set(node, id);
      node.setAttribute(ATTRIBUTE_KEY, id);
    }
  });
  const readyDom = document.getElementsByTagName('html')[0].outerHTML;
  Array.prototype.forEach.call(document.all, (item) => {
    if (item.removeAttribute) item.removeAttribute(ATTRIBUTE_KEY);
  });
  // console.timeEnd('[v-dom] initDomMap');
  return readyDom;
}

export function getIdByElement(ele) {
  // return ele && ele.getAttribute ? ele.getAttribute(ATTRIBUTE_KEY) : null;  // TESTWAY
  return domIdMap.get(ele);
}

// 奇怪的问题 id对不上 solved
function uuid() {
  return Math.random().toString(16).split('.')[1];
}
