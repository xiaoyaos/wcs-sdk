"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WcsSdk = exports.WCSNOTIFY = exports.WCSNOTIFYCONTENTBASE = exports.WCSVERBOSE = exports.WCSPRESETCMD = exports.WCSPTZCMD = exports.WCSVideoEnum = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ws_1 = __importDefault(require("ws"));
const nutils_1 = require("nutils");
// import { subscribe_event_init } from './wcs_subscribe';
// import { init_notify } from './wcs_notify';
var WCSVideoEnum;
(function (WCSVideoEnum) {
    WCSVideoEnum["RTSP"] = "RTSP";
    WCSVideoEnum["WWAV"] = "WWAV";
    WCSVideoEnum["RTMP"] = "RTMP";
    WCSVideoEnum["HLS"] = "HLS";
    WCSVideoEnum["http_flv"] = "http_flv";
    WCSVideoEnum["websocket_flv"] = "websocket_flv";
})(WCSVideoEnum = exports.WCSVideoEnum || (exports.WCSVideoEnum = {}));
var WCSPTZCMD;
(function (WCSPTZCMD) {
    WCSPTZCMD["tilt_up"] = "tilt_up";
    WCSPTZCMD["tilt_down"] = "tilt_down";
    WCSPTZCMD["pan_left"] = "pan_left";
    WCSPTZCMD["pan_right"] = "pan_right";
    WCSPTZCMD["up_left"] = "up_left";
    WCSPTZCMD["up_right"] = "up_right";
    WCSPTZCMD["down_left"] = "down_left";
    WCSPTZCMD["down_right"] = "down_right";
    WCSPTZCMD["zoom_in"] = "zoom_in";
    WCSPTZCMD["zoom_out"] = "zoom_out";
    WCSPTZCMD["focus_in"] = "focus_in";
    WCSPTZCMD["focus_out"] = "focus_out";
    WCSPTZCMD["iris_up"] = "iris_up";
    WCSPTZCMD["iris_down"] = "iris_down";
})(WCSPTZCMD = exports.WCSPTZCMD || (exports.WCSPTZCMD = {}));
var WCSPRESETCMD;
(function (WCSPRESETCMD) {
    WCSPRESETCMD["preset_set"] = "preset_set";
    WCSPRESETCMD["preset_clr"] = "preset_clr";
    WCSPRESETCMD["preset_goto"] = "preset_goto";
})(WCSPRESETCMD = exports.WCSPRESETCMD || (exports.WCSPRESETCMD = {}));
var WCSVERBOSE;
(function (WCSVERBOSE) {
    WCSVERBOSE[WCSVERBOSE["ZERO"] = 0] = "ZERO";
    WCSVERBOSE[WCSVERBOSE["ONE"] = 1] = "ONE";
    WCSVERBOSE[WCSVERBOSE["TWO"] = 2] = "TWO";
    WCSVERBOSE[WCSVERBOSE["THREE"] = 3] = "THREE";
})(WCSVERBOSE = exports.WCSVERBOSE || (exports.WCSVERBOSE = {}));
// ??????-??????content????????????
class WCSNOTIFYCONTENTBASE {
    device_path;
    device_type;
    status;
}
exports.WCSNOTIFYCONTENTBASE = WCSNOTIFYCONTENTBASE;
// ??????-??????????????????
class WCSNOTIFY {
    notify;
    event;
    "content-type";
    content;
}
exports.WCSNOTIFY = WCSNOTIFY;
/**
 * ????????????sdk
 */
class WcsSdk {
    ws;
    heartbeat;
    reconnection_count = 0; // ????????????
    username = "admin";
    password = "admin";
    wcs_ws_url;
    msg_id;
    constructor(username, password, wcs_ws_url) {
        this.username = username;
        this.password = password;
        this.wcs_ws_url = wcs_ws_url;
        this.init();
    }
    init() {
        this.msg_id = 10001;
        this.ws = new ws_1.default(this.wcs_ws_url, {
            perMessageDeflate: false
        });
        this.ws.on('open', () => {
            console.log("open wcs");
            // ?????????????????????????????????
            // init_notify();
            // ????????????
            this.heartbeat = setInterval(() => {
                this.exec(' ');
            }, 10000);
            this.login1();
        });
        this.ws.on('disconnect', function open() {
            console.log("wcs ws disconnect");
        });
        this.ws.on('error', (err) => {
            console.log('wcs ws error', err);
            this.reconnection();
            // this.init();
        });
        this.ws.on('close', (err, reason) => {
            console.log('wcs ws close', err, reason.toString());
            this.reconnection();
            // this.init();
        });
        this.ws.on('message', (data) => {
            data = JSON.parse(data);
            console.log("receive=========>", JSON.stringify(data));
            if (!data.msg_id && data.notify) {
                // console.log("11??????status????????????", data.event + "_wcs_event");
                nutils_1.SocketEvent.emit(data.event + "_wcs_event", data);
            }
            else {
                nutils_1.SocketEvent.emit(data.msg_id, data);
                switch (data.msg_id) {
                    case 101:
                        this.login2(data.content.nonce);
                        // socket???????????????????????????,????????????
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
        };
        await this.exec(req_body);
    }
    async login2(nonce) {
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
     * ws????????????
     */
    async reconnection() {
        // ?????????????????????10???
        await new Promise((res) => {
            setTimeout(() => {
                res(1);
            }, 10000);
        });
        console.log('------------------------wcs ws ????????????');
        this.reconnection_count++;
        // ??????????????????
        clearInterval(this.heartbeat);
        // ????????????
        this.ws.close();
        this.init();
    }
    /**
     * ???????????????nonce??????responce
     */
    getResponce(nonce) {
        const password = crypto_1.default.createHash('md5').update(this.strxor('wwtech_key', this.password)).digest('hex'); //.toString('base64');
        return crypto_1.default.createHash('md5').update(`${this.username}:${password}:${nonce}`).digest('hex'); //.toString('base64');
    }
    /**
     * ????????????url
     * @param content
     * @param type
     * @returns
     */
    async getVideoUrl(content, type) {
        const msg_id = this.getMsgId();
        let request = "open.video." + type;
        let req_body = {
            namespace: "WCS/MMS",
            request,
            msg_id: msg_id,
            content
        };
        this.exec(req_body);
        return msg_id;
    }
    // ????????????
    async closeVideoStream(stream_id) {
        let msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/MMS",
            request: "close.stream",
            msg_id: msg_id,
            content: {
                stream_id: Number(stream_id)
            }
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ???????????????????????????????????????????????????
     * @param stream_id
     * @param type
     * @param cmd
     * @param scale
     * @param range
     */
    async streamCtrl(stream_id, type = "playback", cmd = "PLAY", scale = "1.0", range = "npt=now") {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    // ????????????
    async queryRecord(device_path, start_time, end_time) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    // ????????????
    async openRecord(device_path, start_time, end_time, video_quality = 1, speed = 1) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    // ????????????
    async subscribeDevice(content) {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "subscribe.device",
            msg_id: msg_id,
            "content-type": "--",
            content
        };
        this.exec(req_body);
        return msg_id;
    }
    // ????????????
    async subscribeEvent(content) {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "subscribe.event",
            msg_id: msg_id,
            "content-type": "--",
            content
        };
        this.exec(req_body);
        return msg_id;
    }
    // ????????????
    async cancelSubscribeDevice(sub_id) {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "delete.subscribe",
            msg_id: msg_id,
            "content-type": "--",
            content: {
                sub_id
            }
        };
        this.exec(req_body);
        return msg_id;
    }
    // ??????????????????
    async clearSubscribe() {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "clear.subscribe",
            msg_id: msg_id,
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ????????????  ???????????????????????????????????????path??????:/dist_10/link_1/2000000000
     * ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
     * @param paths ?????????path?????? ???:/dist_10/link_1/2000000000
     * @param device_type
     */
    async quickSubscribe(paths, device_type = 'group/vbox') {
        for (let device_path of paths) {
            device_path = device_path.replace("2000000000", ''); // ??????path???????????????
            let content = {
                device_path: device_path.split('/').slice(0, -2).join('/'),
                device_type
            };
            const msg_id = await this.subscribeDevice(content);
            const result = await nutils_1.SocketEvent.listen(msg_id + '');
            console.log("???????????????????????????:", device_path, "??????: status", "???????????????", result.reply);
            for (const event of ['status', "add"]) {
                let content = {
                    device_path,
                    // device_type:"device/IPC",
                    event
                };
                const msg_id = await this.subscribeDevice(content);
                const result = await nutils_1.SocketEvent.listen(msg_id + '');
                console.log("???????????????:", device_path, "?????????", event, "???????????????", result.reply);
            }
        }
    }
    /**
     * ????????????????????????
     * @param event ????????????
     * @param callback ????????????
     */
    async quickListenEvent(event, callback) {
        if (event == 'add_wcs_event') {
        }
        else if (event == 'delete_wcs_event') {
        }
        else if (event == 'status_wcs_event') {
        }
        else {
            throw new Error(`event: ${event} error`);
        }
        nutils_1.SocketEvent.listens(event, (data) => callback);
    }
    //-----------------------------------------------------------------------------????????????
    /**
     * ????????????--????????????
     * @param device_path
     * @param command
     * @param speed x/y????????????1~255
     * @param token
     * @returns
     */
    async controlPtz(device_path, command, speed, token) {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "control.ptz2",
            msg_id: msg_id,
            content: {
                command: command || "pan_left",
                // tilt_up???tilt_down???pan_left???pan_right???
                // up_left???up_right???down_left???down_right???
                // zoom_in???zoom_out???focus_in??? focus_out???
                // iris_up???iris_down
                params: {
                    token,
                    xspeed: speed.xspeed,
                    yspeed: speed.yspeed // y?????????????????????1~255
                },
                device_path: device_path
            }
        };
        console.log(req_body);
        this.exec(req_body);
        return msg_id;
    }
    // ???????????????
    async ptzConfig(device_path) {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "query.ptz_config",
            msg_id: msg_id,
            content: {
                command: "get_preset_list",
                params: {},
                device_path: device_path
            }
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ???????????????
     * @param device_path
     * @param index
     * @param name
     * @param enable
     * @returns
     */
    async set_preset_name(device_path, index, name, enable) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * preset_set - ??????????????????????????????
     * preset_clr - ?????????????????????
     * preset_goto - ????????????????????????
     * @param device_path
     * @param index
     * @param token
     * @returns
     */
    async preset(device_path, command, index, token) {
        const msg_id = this.getMsgId();
        let req_body = {
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
        };
        if (token) {
            req_body.content.params['token'] = token;
        }
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ????????????????????????
     * @param device_path
     * @returns
     */
    async getLockStatus(device_path) {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "control.ptz2",
            msg_id: msg_id,
            content: {
                command: "get_lock_status",
                device_path: device_path
            }
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ????????????/??????
     * @param device_path
     * @param command lock/unlock
     * @param token
     * @param idle_timeout
     * @returns
     */
    async lock(device_path, command = "lock", token, idle_timeout = 60) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    //-----------------------------------------------------------------------------????????????
    /**
     * ??????????????????????????????????????????
     */
    async exec(body, callback) {
        if (this.ws) {
            if (typeof (body) !== 'string' || body.length > 1) {
                console.log("send=======>", JSON.stringify(body));
            }
            if (callback) {
                this.ws.send(JSON.stringify(body), function () { callback(); });
            }
            else {
                this.ws.send(JSON.stringify(body));
            }
        }
    }
    /**
     * ????????????
     * @param key
     * @param value
     * @returns
     */
    strxor(key, value) {
        let getstr = '';
        const length = value.length;
        for (let i = 0; i < length; i++) {
            const xorstr = value.charCodeAt(i) ^ key.charCodeAt(i %
                key.length);
            const char = String.fromCharCode(xorstr);
            getstr += char;
        }
        return getstr;
    }
    /**
     * ?????????????????????,device_path?????????????????????????????????????????????????????????????????????path
     * @param device_path
     * @param id
     */
    async del_device(device_path, id) {
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
        };
        await this.exec(req_body);
        return msg_id;
    }
    /**
     * ??????ip???port????????????????????????device_path?????????????????????????????????????????????????????????????????????path
     * @param device_path
     * @param ip
     * @param port
     */
    async del_device_by_ip(device_path, ip, port) {
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
        };
        await this.exec(req_body);
    }
    /**
     * ?????????????????????????????????
     * @param device_path
     * @param params IPCDto
     * @returns
     */
    async update_device(device_path, params) {
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
        };
        await this.exec(req_body);
        return msg_id;
    }
    /**
     * ?????????????????????
     * @param device_path
     * @param params IPCDto
     * @returns
     */
    async add_device(device_path, params) {
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
        };
        await this.exec(req_body);
        return msg_id;
    }
    /**
     * ??????????????????
     * @param device_path
     * @param offset
     * @param count
     * @param device_type
     */
    async device_list(device_path, offset, count, verbose = 1) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ????????????????????????
     * @param device_path
     * @param verbose
     */
    async device_info(device_path, verbose = 2) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ????????????
     * @param device_path
     * @param device_code
     * @returns
     */
    async search_device(device_code, device_type = "IPC") {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ??????????????????????????????
     * @param device_path
     * @param offset
     * @param count
     */
    async query_devices(device_path, offset, count) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
   * ????????????????????????????????????
   * @param device_path
   * @param offset
   * @param count
   */
    async query_lan_devices(device_path, offset, count) {
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
        };
        this.exec(req_body);
        return msg_id;
    }
    /**
     * ????????????????????????????????????
     * @param device_path
     * @returns
     */
    async search_lan_devices(device_path) {
        const msg_id = this.getMsgId();
        let req_body = {
            namespace: "WCS/main",
            request: "control.device",
            msg_id: msg_id,
            content: {
                command: "_search_lan_devices",
                device_path,
            }
        };
        this.exec(req_body);
        return msg_id;
    }
}
exports.WcsSdk = WcsSdk;
