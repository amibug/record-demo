import ec from './addons/ec';

export function init(feedbackId) {
  const promises = [];
  const addons = [];
  addons.forEach(addon => {
    promises.push(addon(feedbackId));
  })
  if (addons.length === 0) {
    return new Promise((resolve) => {
      resolve({
        types: [],
        timeline: [],
      });
    });
  }
  return new Promise((resolve) => {
    Promise.all(promises).then(values => {
      // console.log('inited', values);
      let types = [];
      let timeline = [];
      values.forEach(item => {
        if (item) {
          types = Array.prototype.concat.call(types, item.types);
          timeline = Array.prototype.concat.call(timeline, item.timeline);
        }
      });
      resolve({
        types,
        timeline
      });
    });
  })
}
