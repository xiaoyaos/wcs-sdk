import crypto from 'crypto';
import WebSocket from 'ws';
import { SocketEvent } from 'nutils';
// import { subscribe_event_init } from './wcs_subscribe';
// import { init_notify } from './wcs_notify';

export enum WCSVideoEnum {
  "RTSP" = "RTSP", "WWAV" = "WWAV", "RTMP" = "RTMP", "HLS" = "HLS", "http_flv" = "http_flv", "websocket_flv" = "websocket_flv"
}
export enum WCSPTZCMD {
  tilt_up = "tilt_up", tilt_down = "tilt_down", pan_left = "pan_left", pan_right = "pan_right",
  up_left = "up_left", up_right = "up_right", down_left = "down_left", down_right = "down_right",
  zoom_in = 'zoom_in', zoom_out = 'zoom_out', focus_in = 'focus_in', focus_out = 'focus_out',
  iris_up = 'iris_up', iris_down = 'iris_down'
}

export interface WCSPTZSPEED {
  xspeed: number;
  yspeed: number;
}

export enum WCSPRESETCMD {
  'preset_set' = 'preset_set', // 设置当前点位为预置点
  'preset_clr' = 'preset_clr',  // 清楚当前预置点
  'preset_goto' = 'preset_goto',  //  运动到指定预置点
}

export interface WCSDEVICEINFO {
  name: string,
  ip: string,
  port: number,
  uri: string // "http://192.168.8.30/onvif/device" 可选字段
  text_encoding: string, // GBK、UTF-8，除了宇视其他默认都使用GBK 
  username: string,
  password: string,
  chan_num: number, // 可选字段：强制添加的通道数，没有该参数则使用自动识别
  refresh_names: boolean // 可选字段：强制刷新名称，即获取设备本身名称
}

export enum WCSVERBOSE {
  ZERO, ONE, TWO, THREE
}

// 订阅-通知content基础类型
export class WCSNOTIFYCONTENTBASE {
  device_path:string;
  device_type?:string;
  status?:'online'|'offline';
}

// 订阅-通知content设备信息
export interface WCSNOTIFYCONTENTDEVICEINFO extends WCSNOTIFYCONTENTBASE {
  ext_info:{
    audio_encoding:string;
    quality:number;
    record_quality:number;
    support_PTZ:boolean;
    type:string;
    video_encoding:string;
  },
  manufacturer:string;
  model:string;
  name:string;
  version:string;
}

// 订阅-通知基础类型
export class WCSNOTIFY {
  notify: 'device' | 'alarm';
  event: 'add' | 'delete' | 'status' | 'update' | 'property';
  "content-type": 'device_info' | 'status';
  content: WCSNOTIFYCONTENTBASE | WCSNOTIFYCONTENTDEVICEINFO;
}


/**
 * 万维交互sdk
 */
export class WcsSdk {

  ws: WebSocket;
  heartbeat: NodeJS.Timer;
  reconnection_count = 0;       // 重连次数
  username: string = "admin";
  password: string = "admin";
  wcs_ws_url:string;
  msg_id: number;

  constructor(username: string, password: string, wcs_ws_url:string) {
    this.username = username;
    this.password = password;
    this.wcs_ws_url = wcs_ws_url;
    this.init()
  }

  init() {
    this.msg_id = 10001;
    this.ws = new WebSocket(this.wcs_ws_url, {
      perMessageDeflate: false
    });
    this.ws.on('open', () => {
      console.log("open wcs");
      // 初始化监听万为事件通知
      // init_notify();

      // 注册心跳
      this.heartbeat = setInterval(() => {
        this.exec(' ')
      }, 10000)

      this.login1()
    });
    this.ws.on('disconnect', function open() {
      console.log("wcs ws disconnect")
    });
    this.ws.on('error', (err) => {
      console.log('wcs ws error', err);
      // this.reconnection();
      // this.init();
    });
    this.ws.on('close', (err, reason) => {
      console.log('wcs ws close', err, reason.toString());
      this.reconnection();
      // this.init();
    });
    this.ws.on('message', (data: any) => {
      data = JSON.parse(data);
      console.log("receive=========>", JSON.stringify(data))
      if (!data.msg_id && data.notify) {
        // console.log("11收到status事件通知", data.event + "_wcs_event");
        SocketEvent.emit(data.event + "_wcs_event", data);
      } else {
        SocketEvent.emit(data.msg_id, data);
        switch (data.msg_id) {
          case 101:
            this.login2(data.content.nonce);
            // socket链接建立成功且登入,订阅事件
            // subscribe_event_init();
            break;
          default:
            break;
        }
      }
    });
  }

  getMsgId() {
    return this.msg_id++;
  }
  /**
   * login
   */
  async login1() {
    let req_body = {
      namespace: "",
      request: "login",
      msg_id: 101,
      content: {
        version: 2,
        sdk_type: "js",
        user_name: this.username
      }
    }
    await this.exec(req_body);
  }

  async login2(nonce: string) {
    let responce = this.getResponce(nonce);
    await this.exec({
      namespace: "",
      request: "login",
      msg_id: 102,
      content: {
        responce
      }
    });
  }

  /**
   * ws重新连接
   */
  async reconnection() {
    // 每次重连都延迟10秒
    await new Promise((res) => {
      setTimeout(() => {
        res(1);
      }, 10000);
    });
    console.log('------------------------wcs ws 重新连接');
    this.reconnection_count++;
    // 关闭心跳任务
    clearInterval(this.heartbeat);
    // 关闭连接
    // this.ws.close();
    this.init();
  }

  /**
   * 根据返回的nonce生成responce
   */
  getResponce(nonce: string) {
    const password = crypto.createHash('md5').update(this.strxor('wwtech_key', this.password)).digest('hex')//.toString('base64');
    return crypto.createHash('md5').update(`${this.username}:${password}:${nonce}`).digest('hex')//.toString('base64');
  }

  /**
   * 获取播放url
   * @param content 
   * @param type 
   * @returns 
   */
  async getVideoUrl(content: any, type: WCSVideoEnum) {
    const msg_id = this.getMsgId();
    let request = "open.video." + type
    let req_body = {
      namespace: "WCS/MMS",
      request,
      msg_id: msg_id,
      content
    }
    this.exec(req_body);
    return msg_id;
  }

  // 关闭码流
  async closeVideoStream(stream_id: number) {
    let msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/MMS",
      request: "close.stream",
      msg_id: msg_id,
      content: {
        stream_id: Number(stream_id)
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 控制码流【快进、暂停、播放、倍速】
   * @param stream_id 
   * @param type 
   * @param cmd 
   * @param scale 
   * @param range 
   */
  async streamCtrl(stream_id: number, type = "playback", cmd = "PLAY", scale = "1.0", range = "npt=now") {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/MMS",
      request: "close.stream",
      msg_id: msg_id,
      content: {
        stream_id: Number(stream_id),
        type,
        params: {
          cmd,
          scale,
          range
        }
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  // 查询录像
  async queryRecord(device_path: string, start_time: number, end_time: number) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/MMS",
      request: "query.record",
      msg_id: msg_id,
      content: {
        device_path,
        params: {
          start_time,
          end_time,
          type: 'all',
          tz_delta: 0
        }
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  // 打开录像
  async openRecord(device_path: string, start_time: number, end_time: number, video_quality = 1, speed = 1) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/MMS",
      request: "open.record",
      msg_id: msg_id,
      content: {
        device_path,
        params: {
          start_time,
          end_time,
          tz_delta: 0,
          video_quality,
          speed
        }
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  // 订阅消息
  async subscribeDevice(content: any) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "subscribe.device",
      msg_id: msg_id,
      "content-type": "--",
      content
    }
    this.exec(req_body);
    return msg_id;
  }

  // 订阅事件
  async subscribeEvent(content: any) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "subscribe.event",
      msg_id: msg_id,
      "content-type": "--",
      content
    }
    this.exec(req_body);
    return msg_id;
  }

  // 取消订阅
  async cancelSubscribeDevice(sub_id: number) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "delete.subscribe",
      msg_id: msg_id,
      "content-type": "--",
      content: {
        sub_id
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  // 取消全部订阅
  async clearSubscribe() {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "clear.subscribe",
      msg_id: msg_id,
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 快捷订阅  传入大数据融合平台中盒子的path，例:/dist_10/link_1/2000000000
   * 该订阅会自动订阅每个盒子的状态事件（如果盒子下有某个视频设备状态变化也会通知）
   * @param paths 盒子的path数组 例:/dist_10/link_1/2000000000
   * @param device_type 
   */
  async quickSubscribe(paths: string[], device_type: 'group/vbox' | 'group/IPC' = 'group/vbox') {
    for (let device_path of paths) {
      device_path = device_path.replace("2000000000", ''); // 去除path中的结尾符
      let content = {
        device_path: device_path.split('/').slice(0, -2).join('/'), // 按照网关盒子等级订阅
        device_type
      }
      const msg_id = await this.subscribeDevice(content);
      const result = await SocketEvent.listen(msg_id + '');
      console.log("已订阅网关盒子状态:", device_path, "事件: status", "订阅响应：", result.reply);

      for (const event of ['status', "add"]) {
        let content = {
          device_path,
          // device_type:"device/IPC",
          event
        }
        const msg_id = await this.subscribeDevice(content);
        const result = await SocketEvent.listen(msg_id + '');
        console.log("已订阅网关:", device_path, "事件：", event, "订阅响应：", result.reply)
      }
    }
  }

  /**
   * 快捷注册事件处理
   * @param event 事件类型
   * @param callback 回调处理
   */
  async quickListenEvent(event: 'status_wcs_event' | 'delete_wcs_event' | 'add_wcs_event', callback: (data:WCSNOTIFY)=>void) {
    if (event == 'add_wcs_event') {

    } else if (event == 'delete_wcs_event') {

    } else if (event == 'status_wcs_event') {

    } else {
      throw new Error(`event: ${event} error`);
    }
    SocketEvent.listens(event, (data:WCSNOTIFY)=>callback);
  }

  //-----------------------------------------------------------------------------云台控制
  /**
   * 云台控制--方向控制
   * @param device_path 
   * @param command 
   * @param speed x/y方向转速1~255
   * @param token 
   * @returns 
   */
  async controlPtz(device_path: string, command: WCSPTZCMD, speed: WCSPTZSPEED, token: string) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "control.ptz2",
      msg_id: msg_id,
      content: {
        command: command || "pan_left",
        // tilt_up、tilt_down、pan_left、pan_right、
        // up_left、up_right、down_left、down_right、
        // zoom_in、zoom_out、focus_in、 focus_out、
        // iris_up、iris_down
        params: {
          token, // 非必须，云台锁定之后需要传入正确token才能控制
          xspeed: speed.xspeed, // x方向转动速度：1~255
          yspeed: speed.yspeed // y方向转动速度：1~255
        },
        device_path: device_path
      }
    }
    console.log(req_body)
    this.exec(req_body);
    return msg_id;
  }

  // 预置点列表
  async ptzConfig(device_path: string) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "query.ptz_config",
      msg_id: msg_id,
      content: {
        command: "get_preset_list",
        params: {
        },
        device_path: device_path
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 预置点设置
   * @param device_path 
   * @param index 
   * @param name 
   * @param enable 
   * @returns 
   */
  async set_preset_name(device_path: string, index: number, name: string, enable: boolean) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "set.ptz_config",
      msg_id: msg_id,
      content: {
        command: "set_preset_name",
        params: {
          index,
          name,
          enable
        },
        device_path: device_path
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * preset_set - 设置当前点位为预置点
   * preset_clr - 清楚当前预置点
   * preset_goto - 运动到指定预置点
   * @param device_path 
   * @param index 
   * @param token 
   * @returns 
   */
  async preset(device_path: string, command: WCSPRESETCMD, index: number, token: string) {
    const msg_id = this.getMsgId();
    let req_body: any = {
      namespace: "WCS/main",
      request: "control.ptz2",
      msg_id: msg_id,
      content: {
        command,
        params: {
          index
        },
        device_path: device_path
      }
    }
    if (token) {
      req_body.content.params['token'] = token;
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 获取云台锁定状态
   * @param device_path 
   * @returns 
   */
  async getLockStatus(device_path: string) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "control.ptz2",
      msg_id: msg_id,
      content: {
        command: "get_lock_status",
        device_path: device_path
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 云台锁定/解锁
   * @param device_path 
   * @param command lock/unlock
   * @param token 
   * @param idle_timeout 
   * @returns 
   */
  async lock(device_path: string, command: 'lock' | 'unlock' = "lock", token: string, idle_timeout = 60) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "control.ptz2",
      msg_id: msg_id,
      content: {
        command,
        params: {
          token,
          idle_timeout,
        },
        device_path: device_path
      }
    }
    this.exec(req_body);
    return msg_id;
  }
  //-----------------------------------------------------------------------------云台控制
  /**
   * 将封装好的请求发送给万维盒子
   */
  async exec(body: any, callback?: Function) {
    if (this.ws) {
      if (typeof (body) !== 'string' || body.length > 1) {
        console.log("send=======>", JSON.stringify(body))
      }
      if (callback) {
        this.ws.send(JSON.stringify(body), function () { callback() })
      } else {
        this.ws.send(JSON.stringify(body))
      }
    }
  }



  /**
   * 密码异或
   * @param key 
   * @param value 
   * @returns 
   */
  strxor(key: string, value: string) {
    let getstr = ''
    const length = value.length
    for (let i = 0; i < length; i++) {
      const xorstr = value.charCodeAt(i) ^ key.charCodeAt(i %
        key.length)
      const char = String.fromCharCode(xorstr)
      getstr += char
    }
    return getstr
  }

  /**
   * 远程删除摄像头,device_path是指删除某个目录下的设备，也就是设备所属的目录path
   * @param device_path 
   * @param id 
   */
  async del_device(device_path: string, id: string) {
    let msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "set.vbox_config",
      msg_id: msg_id,
      content: {
        command: "_del_device",
        params: {
          id
        },
        device_path,
      }
    }
    await this.exec(req_body);
    return msg_id;
  }
  /**
   * 根据ip与port远程删除摄像头，device_path是指删除某个目录下的设备，也就是设备所属的目录path
   * @param device_path 
   * @param ip 
   * @param port 
   */
  async del_device_by_ip(device_path: string, ip: string, port: number) {
    let req_body = {
      namespace: "WCS/main",
      request: "set.vbox_config",
      msg_id: 105,
      content: {
        command: "_del_device",
        params: {
          ip, port
        },
        device_path,
      }
    }
    await this.exec(req_body);
  }


  /**
   * 更新设备信息（摄像头）
   * @param device_path 
   * @param params IPCDto
   * @returns 
   */
  async update_device(device_path: string, params: WCSDEVICEINFO) {
    let msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "set.vbox_config",
      msg_id: msg_id,
      content: {
        command: "_update_device",
        params,
        device_path,
      }
    }
    await this.exec(req_body);
    return msg_id;
  }
  /**
   * 远程添加摄像头
   * @param device_path 
   * @param params IPCDto
   * @returns 
   */
  async add_device(device_path: string, params: WCSDEVICEINFO) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "set.vbox_config",
      msg_id: msg_id,
      content: {
        command: "_add_device",
        params,
        device_path,
      }
    }
    await this.exec(req_body);
    return msg_id;
  }

  /**
   * 查询设备列表
   * @param device_path 
   * @param offset 
   * @param count 
   * @param device_type 
   */
  async device_list(device_path: string, offset: number, count: number, verbose: WCSVERBOSE = 1) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "query.device_list",
      msg_id: msg_id,
      content: {
        offset,
        count: count > 50 ? 50 : count,
        device_path,
        verbose,
        device_type: ""
      }
    }
    this.exec(req_body);
    return msg_id;

  }

  /**
   * 查询单个设备信息
   * @param device_path 
   * @param verbose 
   */
  async device_info(device_path: string, verbose: WCSVERBOSE = 2) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "query.device",
      msg_id: msg_id,
      "content-type": "query_params",
      content: {
        device_path,
        verbose,
      }
    }
    this.exec(req_body);
    return msg_id
  }

  /**
   * 搜索设备
   * @param device_path 
   * @param device_code 
   * @returns 
   */
  async search_device(device_code: string, device_type = "IPC") {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "search.device",
      msg_id: msg_id,
      "content-type": "---",
      content: {
        // device_type,
        device_code,
        // offset:0,
        // count: 50,
      }
    }
    this.exec(req_body);
    return msg_id
  }

  /**
   * 获取指定网关下的设备
   * @param device_path 
   * @param offset 
   * @param count 
   */
  async query_devices(device_path: string, offset: number, count: number,) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "query.vbox_config",
      msg_id: msg_id,
      content: {
        command: "_get_devices",
        params: {
          offset,
          count: count > 50 ? 50 : count,
          export_channels: false
        },
        device_path,
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 获取网关下局域网设备列表
   * @param device_path
   * @param offset
   * @param count
   */
  async query_lan_devices(device_path: string, offset: number, count: number,) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "query.vbox_config",
      msg_id: msg_id,
      content: {
        command: "_get_lan_devices",
        params: {
          offset,
          count: count > 50 ? 50 : count,
        },
        device_path,
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 获取指定设备下通道列表
   * @param device_path 网关path 例:/dist_15/link_1/2000000000
   * @param uuid 设备uuid 例:b4dd74da94ac63b96b0a906393ae8c69
   * @param offset
   * @param count
   */
  async query_device_channels(device_path: string, uuid:string, offset: number, count: number,) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "query.vbox_config",
      msg_id: msg_id,
      content: {
        command: "_get_channels",
        params: {
          id:uuid,
          offset,
          count: count,
        },
        device_path,
      }
    }
    this.exec(req_body);
    return msg_id;
  }

  /**
   * 主动搜索网关下局域网设备
   * @param device_path 
   * @returns 
   */
  async search_lan_devices(device_path: string) {
    const msg_id = this.getMsgId();
    let req_body = {
      namespace: "WCS/main",
      request: "control.device",
      msg_id: msg_id,
      content: {
        command: "_search_lan_devices",
        device_path,
      }
    }
    this.exec(req_body);
    return msg_id;
  }

}

