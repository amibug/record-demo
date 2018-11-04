const debug = location.search.indexOf('__debugMode__=1') > -1;
const apiHost = debug ? '' : '';

export default function (feedbackId) {
  return new Promise((resolve, reject) => {
    if (feedbackId) {
      fetch(`${apiHost}/api/feedback/queryLogByFeedbackId?feedbackId=${feedbackId}`, { cors: true })
        .then(res => res.json())
        .then((res) => {
          if (res && res.success && res.result) {
            resolve({
              types: [
                { type: 'ajax', icon: null, color: 'yellow' },
                { type: 'jserror', icon: null, color: 'red' },
              ],
              timeline: res.result,
            });
          } else {
            resolve({
              types: [],
              timeline: [],
            });
          }
        })
        .catch((error) => {
          reject();
        });
    } else {
      resolve();
    }
  });
}

function getParameterByName(_name, _url) {
  const url = _url || window.location.href;
  const name = _name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
