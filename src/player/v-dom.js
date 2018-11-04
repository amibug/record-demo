const idDomMap = new Map();
const domIdMap = new Map();

const ATTRIBUTE_KEY = 'data-uuid';
let iDocument;

export function addNode(node) {
  if (node && node.getAttribute) {
    const id = node.getAttribute(ATTRIBUTE_KEY);
    if (id) {
      idDomMap.set(id, node);
      domIdMap.set(node, id);
    }
  }
  if (node.children && node.children.length > 0) {
    Array.prototype.forEach.call(node.children, addNode);
  }
}

export function initDom(dom) {
  console.time('[v-dom] initDomMap');
  iDocument = dom;
  Array.prototype.forEach.call(dom.all, (node) => {
    if (node && node.getAttribute) {
      const id = node.getAttribute(ATTRIBUTE_KEY);
      if (id) {
        idDomMap.set(id, node);
        domIdMap.set(node, id);
      }
    }
  });
  console.timeEnd('[v-dom] initDomMap');
}

export function getIdByElement(ele) {
  return domIdMap.get(ele);
}

export function getElementById(id) {
  return idDomMap.get(id);
}

window.getIdByElement = getIdByElement;
window.getElementById = getElementById;