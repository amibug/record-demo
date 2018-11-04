import { start as recorderStart, end as recorderEnd } from './recorder';
import { initConfig } from '../service';
import { warning } from '../help/util';
import store from '../store';
// import { listenFormChange } from './actions';

let inited = false;

export function init(params = null) {
  try {
    if (inited) {
      return;
    }
    inited = true;

    const __INSIGHTS = params || {};
    const _config = __INSIGHTS.config || {};
    // console.log(1, _config);
    const {
      showUI = true,
      appkey = null,
      uid = null,
    } = _config;

    initConfig(_config);

    if (showUI === true) {
      // initUI((extraData) => {
      //   return recorderEnd({
      //     extraData
      //   });
      // });
    }
  } catch (e) {
    warning('执行init发生异常');
  }
}

export function start(...args) {
  try {
    if (inited === false) {
      warning('cannot start before init!');
      return;
    }
    // recorderStart(...args).then(console.log).catch(() => { console.log('fail!!!!!!!!!')});
    return recorderStart(...args);
  } catch (e) {
    warning('执行start发生异常', e);
  }
}

export function end(...args) {
  const isRecording = store.get('isRecording');
  try {
    if (isRecording && inited === false) {
      console.warn('[insihgts] cannot end before init!');
      return;
    }
    return recorderEnd(...args);
  } catch (e) {
    warning('执行end发生异常', e);
    return new Promise((r, j) => {
      j();
    })
  }
}

// function renderIcon() {
//   const div = document.createElement('div');
//   div.innerHTML = '反馈';
//   div.className = 'recorder-icon';
//   div.onclick = end;
//   div.style = `
//     position: fixed;
//     top: 20px;
//     right: 20px;
//     background-color: #ff7300;
//     width: 70px;
//     height: 30px;
//     line-height: 30px;
//     font-size: 16px;
//     color: #fff;
//     z-index: 9999;
//     border-radius: 3px;
//     cursor: pointer;
//     text-align: center;
//    `;
//   document.body.appendChild(div);
// }
