const { request } = require('../../utils/request');
const { imWSURL } = require('../../utils/config');

Page({
  data: {
    uid: 0,
    dialog: [],
    input: ''
  },
  onLoad(query) {
    const uid = Number(query.uid || 0);
    this.setData({ uid });
    this.ensureChat(uid);
    this.loadMore(0);
    this.connectWS();
  },
  async ensureChat(uid) {
    try { await request({ url: `/msg/chat/create/${uid}` }); } catch (_) {}
    try { await request({ url: `/msg/chat/online`, data: { from: uid } }); } catch (_) {}
  },
  async loadMore(offset) {
    try {
      const res = await request({ url: '/msg/chat-detailed/get-more', data: { uid: this.data.uid, offset } });
      const list = (res && (res.data || res.list)) || [];
      const mapped = list.map(it => ({
        id: it.id,
        content: it.content,
        mine: !!it.mine,
        avatar: it.avatar,
        timeText: it.time || ''
      }));
      this.setData({ dialog: mapped.reverse() });
    } catch (_) {}
  },
  connectWS() {
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token') || '';
    const url = `${imWSURL.replace('ws://','wss://')}/im`;
    const task = wx.connectSocket({ url: url.indexOf('://')>0?url:`${imWSURL}/im` });
    this.socketTask = task;
    task.onOpen(() => {
      const hello = { code: 100, content: `Bearer ${token}` };
      task.send({ data: JSON.stringify(hello) });
    });
    task.onMessage(({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (msg && msg.type === 'whisper' && msg.data && msg.data.type === '接收') {
          const d = msg.data.detail || msg.data;
          const one = { id: d.id, content: d.content, mine: false, avatar: d.avatar };
          this.setData({ dialog: this.data.dialog.concat(one) });
        }
      } catch (_) {}
    });
  },
  onUnload() {
    try { wx.closeSocket(); } catch (_) {}
    try { request({ url: '/msg/chat/outline', data: { from: this.data.uid, to: '' } }); } catch(_){}
  },
  onInput(e) { this.setData({ input: e.detail.value }); },
  onSend() {
    const content = (this.data.input || '').trim();
    if (!content || !this.socketTask) return;
    const body = { code: 101, anotherId: this.data.uid, content };
    this.socketTask.send({ data: JSON.stringify(body) });
    const mine = { id: Date.now(), content, mine: true };
    this.setData({ dialog: this.data.dialog.concat(mine), input: '' });
  }
});


