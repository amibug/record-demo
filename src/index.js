import ReactDom from 'react-dom';
import React, { Component } from 'react';
import request from 'superagent';
import classnames from 'classnames';
import { Switch, Popover, Spin, Table } from 'antd';
import { init as initDomPlayer, play, pause, jump } from './Record/domPlayer';
import styles from './Record/record.less';

// addons
import { init as addonInit } from './Record/addon';

function render(App) {
  const initialState = window.__initData__ || {};
  ReactDom.render(<App {...initialState} />, document.getElementById('container'));
}

const mutationWontShowTypes = ['childList', 'characterData', 'attributes', 'scroll', 'move'];
const eventConfig = {
  click: {
    icon: 'icon-click',
    color: '#FDA831',
    render: ({ x, y }) => `x: ${x} y: ${y}`,
  },
  viewport: {
    icon: 'icon-resize',
    color: '#48BA95',
    render: ({ w, h }) => `宽: ${w} 高: ${h}`,
  },
  ajax: {
    icon: null,
    color: 'yellow',
    render: ({ url }) => url,
  },
  jserror: {
    icon: null,
    color: 'red',
    // render: ({  }) => ``,
  },
};

const timeToString = (time) => {
  const totalSeconds = Math.floor(time / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds - (minutes * 60));
  const zeros = num => (num < 10 ? `0${num}` : num);
  return `${zeros(minutes)}:${zeros(seconds)}`;
};

// 渲染右侧事件详情表
const renderMutationDetail = (data) => {
  const columns = [{
    title: 'Key',
    dataIndex: 'key',
    width: 110,
  }, {
    title: 'Value',
    dataIndex: 'value',
  }];
  const dataSource = Object.keys(data).map(key => ({
    key,
    value: data[key],
  }));
  return <Table pagination={false} columns={columns} dataSource={dataSource} />;
};

class RecordDetail extends Component {
  constructor(props) {
    super(props);
    this.state = {
      time: 0,
      loading: true,
      playing: false,
      duration: 0,
      showMouse: false,
    };
  }

  componentDidMount() {
    this.getRecordJson().then((res) => {
      const data = JSON.parse(res.text);
      const { mutations } = data;
      const duration = mutations[mutations.length - 1].t;

      // mock
      // mutations.unshift({
      //   type: 'ajax',
      //   url: 'example',
      // });

      // addon
      const feedbackId = window.__initData__.recordData.id;
      addonInit(feedbackId).then((addonData) => {
        // addonData
        if (addonData) {
          const { types = [], timeline = [] } = addonData;
          types.forEach((item) => {
            if (item.type && !eventConfig[item.type]) {
              const defaultRender = ({ content }) => { return content; };
              item.render = item.render || defaultRender;
              eventConfig[item.type] = item;
            }
          });
          timeline.forEach((item) => {
            item.t = parseInt(item.time, 10);
            mutations.push(item);
          });
        }
        this.setState({
          loading: false,
          mutations,
          duration,
        });
        // player start
        initDomPlayer({
          data,
          domContainer: this.domContainer,
          onTimeChange: (time) => {
            this.setState({ time });
            const firstIndex = this.calculateFirstActiveEventIndex(time);
            if (this.eventPanel) {
              let scrollTop = 70 * firstIndex - this.eventPanel.clientHeight * 0.3;
              scrollTop = scrollTop > 0 ? scrollTop : 0;
              this.eventPanel.scrollTop = scrollTop;
              // this.eventPanel.getElementsByClassName('change-item')[firstIndex].scrollIntoView({
              //   behavior: 'auto',
              //   block: 'center',
              //   // alignTop: 100,
              // });
            }
          },
        });
        this.listenKeyboard();
        this.progressContainer.addEventListener('click', this.progressClick, true);
        // play();
      });
    });
  }

  getRecordJson() {
    const { recordData } = this.props;
    return request.get(recordData.recordJsonUrl);
  }

  getEventMutations = () => {
    return this.state.mutations.filter(({ type }) => mutationWontShowTypes.indexOf(type) === -1)
      .sort((a, b) => { return a.t - b.t; });
  }

  listenKeyboard = () => {
    const keyUpCallbacks = {
      32: () => { // 播放暂停
        this.playOrPause();
      },
      39: () => { // 右方向
        this.jump(this.state.time + (1000 * 5));
      },
      37: () => { // 左方向
        this.jump(this.state.time + (1000 * -5));
      },
    };
    document.addEventListener('keyup', (e) => {
      const { keyCode } = e;
      // console.log(keyCode);
      if (keyUpCallbacks[keyCode]) {
        keyUpCallbacks[keyCode]();
      }
    });
  }

  playOrPause = () => {
    const { playing } = this.state;
    this.setState({
      playing: !playing,
    });
    if (playing) {
      pause();
    } else {
      play();
    }
  }

  jump = (time) => {
    const { playing } = this.state;
    if (playing) {
      this.playOrPause();
    }
    jump(time);
    if (playing) {
      this.playOrPause();
    }
  }

  progressClick = (e) => {
    const { duration } = this.state;
    const { offsetX } = e;
    const width = this.progressContainer.clientWidth;
    // console.log(offsetX, width);
    const jumpRatio = offsetX / width;
    this.jump(duration * jumpRatio);
  }

  calculateFirstActiveEventIndex = (_time) => {
    const { time } = this.state;
    const mutations = this.getEventMutations();
    const playedTime = _time || time;
    let index = 0;
    const count = mutations.length;
    if (mutations[count - 1].t <= playedTime) {
      return count - 1;
    }
    for (let i = 0; i < count; i += 1) {
      const { t } = mutations[i];
      if (t >= playedTime) {
        index = i;
        break;
      }
    }
    return index;
  }

  render() {
    const { recordData } = this.props;
    const { time, duration, loading, playing, showMouse } = this.state;
    const playedRatio = time / duration;

    return (
      <div className={classnames({
        [styles.recordDetail]: true,
        'no-operation': !showMouse,
      })}
      >
        <Spin spinning={loading}>
          <div className="header">
            <span className="title">录制回放</span>
            <div className="record-info">
              <span className="info-item">
                <i className="iconfont icon-time" />
                <span className="info-value start-time">{new Date(recordData.startTime).toLocaleString()}</span>
              </span>
            </div>
          </div>
          <div className="content">
            <div className="left-panel">
              <div className="dom-play-container" onClick={this.playOrPause}>
                {
                  !playing && (
                    <div className="playing-state-mask">
                      <i className="iconfont icon-play" />
                    </div>
                  )
                }
                <div className="dom-container" ref={(ele) => { this.domContainer = ele; }} />
              </div>
              <div className="operation-bar">
                <div className="progress-bar" ref={(el) => { this.progressContainer = el; }}>
                  <div className="played" style={{ width: `${playedRatio * 100}%`, height: '100%' }} />
                  <div className="progress-events">
                    {
                      loading === false && (
                        this.getEventMutations().map(({ type, t }) => {
                          const { color } = eventConfig[type] || {};
                          return (
                            <div
                              className={classnames({
                                'progress-events-item': true,
                                played: t < time,
                              })}
                              style={{
                                left: `${(t / duration) * 100}%`,
                                backgroundColor: color,
                              }}
                              onClick={this.jump.bind(this, t)}
                            />
                          );
                        })
                      )
                    }
                  </div>
                  <div className="point" style={{ left: `${playedRatio * 100}%` }} />
                </div>
                <div className="play-btn" onClick={this.playOrPause}>
                  <i className={classnames({
                      iconfont: true,
                      'icon-play': !playing,
                      'icon-pause': playing,
                    })}
                  />
                </div>
                <div className="play-time">{timeToString(time)}/{timeToString(duration)}</div>
                <div className="show-mouse">
                  <Switch
                    checked={showMouse}
                    onChange={() => { this.setState({ showMouse: !showMouse }); }}
                  />
                  <span className="shou-mouse-text">是否展示鼠标及轨迹</span>
                </div>
              </div>
            </div>
            <div className="right-panel">
              <div className="events" ref={(el) => { this.eventPanel = el; }}>
                {
                  loading === false && (
                    this.getEventMutations().map(({ type, t, ...others }, index) => {
                      const { icon, render: renderItem, color, content } = eventConfig[type] || {};
                      const msg = renderItem ? renderItem(others) : content;
                      const className = classnames({
                        'change-item': true,
                        played: t < time,
                      });
                      const strTime = timeToString(t);
                      const detailCardTitle = '事件详情';
                      const detailCardContent = (
                        <div className="mutation-detail-card" style={{ minWidth: 250, maxWidth: 500, maxHeight: 500, overflow: 'auto' }}>
                          <p>类型：{type}</p>
                          <p>时间：{strTime}</p>
                          <p>详情：{renderMutationDetail(others)}</p>
                        </div>
                      );

                      return (
                        <Popover key={`${type}-${t}`} placement="leftTop" title={detailCardTitle} content={detailCardContent} trigger="hover" >
                          <div
                            className={className}
                            onClick={this.jump.bind(this, t)}
                            style={{ borderLeft: `10px solid ${color}` }}
                          >
                            <div className="type-and-time">
                              <span className="event-index">{index}</span>
                              <i className={`type-icon iconfont ${icon}`} />
                              <span className="event-type">{type}</span>
                              <span className="event-time">{strTime}</span>
                            </div>
                            <span title={msg} className="content">{msg}</span>
                          </div>
                        </Popover>
                      );
                    })
                  )
                }
              </div>
            </div>
          </div>
        </Spin>
      </div>
    );
  }
}

render(RecordDetail);
