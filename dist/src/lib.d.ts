/// <reference types="node" />
import WebSocket from 'ws';
export declare enum WCSVideoEnum {
    "RTSP" = "RTSP",
    "WWAV" = "WWAV",
    "RTMP" = "RTMP",
    "HLS" = "HLS",
    "http_flv" = "http_flv",
    "websocket_flv" = "websocket_flv"
}
export declare enum WCSPTZCMD {
    tilt_up = "tilt_up",
    tilt_down = "tilt_down",
    pan_left = "pan_left",
    pan_right = "pan_right",
    up_left = "up_left",
    up_right = "up_right",
    down_left = "down_left",
    down_right = "down_right",
    zoom_in = "zoom_in",
    zoom_out = "zoom_out",
    focus_in = "focus_in",
    focus_out = "focus_out",
    iris_up = "iris_up",
    iris_down = "iris_down"
}
export interface WCSPTZSPEED {
    xspeed: number;
    yspeed: number;
}
export declare enum WCSPRESETCMD {
    'preset_set' = "preset_set",
    'preset_clr' = "preset_clr",
    'preset_goto' = "preset_goto"
}
export interface WCSDEVICEINFO {
    name: string;
    ip: string;
    port: number;
    uri: string;
    text_encoding: string;
    username: string;
    password: string;
    chan_num: number;
    refresh_names: boolean;
}
export declare enum WCSVERBOSE {
    ZERO = 0,
    ONE = 1,
    TWO = 2,
    THREE = 3
}
export declare class WCSNOTIFYCONTENTBASE {
    device_path: string;
    device_type?: string;
    status?: 'online' | 'offline';
}
export interface WCSNOTIFYCONTENTDEVICEINFO extends WCSNOTIFYCONTENTBASE {
    ext_info: {
        audio_encoding: string;
        quality: number;
        record_quality: number;
        support_PTZ: boolean;
        type: string;
        video_encoding: string;
    };
    manufacturer: string;
    model: string;
    name: string;
    version: string;
}
export declare class WCSNOTIFY {
    notify: 'device' | 'alarm';
    event: 'add' | 'delete' | 'status' | 'update' | 'property';
    "content-type": 'device_info' | 'status';
    content: WCSNOTIFYCONTENTBASE | WCSNOTIFYCONTENTDEVICEINFO;
}
/**
 * 万维交互sdk
 */
export declare class WcsSdk {
    ws: WebSocket;
    heartbeat: NodeJS.Timer;
    reconnection_count: number;
    username: string;
    password: string;
    wcs_ws_url: string;
    msg_id: number;
    constructor(username: string, password: string, wcs_ws_url: string);
    init(): void;
    getMsgId(): number;
    /**
     * login
     */
    login1(): Promise<void>;
    login2(nonce: string): Promise<void>;
    /**
     * ws重新连接
     */
    reconnection(): Promise<void>;
    /**
     * 根据返回的nonce生成responce
     */
    getResponce(nonce: string): string;
    /**
     * 获取播放url
     * @param content
     * @param type
     * @returns
     */
    getVideoUrl(content: any, type: WCSVideoEnum): Promise<number>;
    closeVideoStream(stream_id: number): Promise<number>;
    /**
     * 控制码流【快进、暂停、播放、倍速】
     * @param stream_id
     * @param type
     * @param cmd
     * @param scale
     * @param range
     */
    streamCtrl(stream_id: number, type?: string, cmd?: string, scale?: string, range?: string): Promise<number>;
    queryRecord(device_path: string, start_time: number, end_time: number): Promise<number>;
    openRecord(device_path: string, start_time: number, end_time: number, video_quality?: number, speed?: number): Promise<number>;
    subscribeDevice(content: any): Promise<number>;
    subscribeEvent(content: any): Promise<number>;
    cancelSubscribeDevice(sub_id: number): Promise<number>;
    clearSubscribe(): Promise<number>;
    /**
     * 快捷订阅  传入大数据融合平台中盒子的path，例:/dist_10/link_1/2000000000
     * 该订阅会自动订阅每个盒子的状态事件（如果盒子下有某个视频设备状态变化也会通知）
     * @param paths 盒子的path数组 例:/dist_10/link_1/2000000000
     * @param device_type
     */
    quickSubscribe(paths: string[], device_type?: 'group/vbox' | 'group/IPC'): Promise<void>;
    /**
     * 快捷注册事件处理
     * @param event 事件类型
     * @param callback 回调处理
     */
    quickListenEvent(event: 'status_wcs_event' | 'delete_wcs_event' | 'add_wcs_event', callback: (data: WCSNOTIFY) => void): Promise<void>;
    /**
     * 云台控制--方向控制
     * @param device_path
     * @param command
     * @param speed x/y方向转速1~255
     * @param token
     * @returns
     */
    controlPtz(device_path: string, command: WCSPTZCMD, speed: WCSPTZSPEED, token: string): Promise<number>;
    ptzConfig(device_path: string): Promise<number>;
    /**
     * 预置点设置
     * @param device_path
     * @param index
     * @param name
     * @param enable
     * @returns
     */
    set_preset_name(device_path: string, index: number, name: string, enable: boolean): Promise<number>;
    /**
     * preset_set - 设置当前点位为预置点
     * preset_clr - 清楚当前预置点
     * preset_goto - 运动到指定预置点
     * @param device_path
     * @param index
     * @param token
     * @returns
     */
    preset(device_path: string, command: WCSPRESETCMD, index: number, token: string): Promise<number>;
    /**
     * 获取云台锁定状态
     * @param device_path
     * @returns
     */
    getLockStatus(device_path: string): Promise<number>;
    /**
     * 云台锁定/解锁
     * @param device_path
     * @param command lock/unlock
     * @param token
     * @param idle_timeout
     * @returns
     */
    lock(device_path: string, command: "lock" | "unlock" | undefined, token: string, idle_timeout?: number): Promise<number>;
    /**
     * 将封装好的请求发送给万维盒子
     */
    exec(body: any, callback?: Function): Promise<void>;
    /**
     * 密码异或
     * @param key
     * @param value
     * @returns
     */
    strxor(key: string, value: string): string;
    /**
     * 远程删除摄像头,device_path是指删除某个目录下的设备，也就是设备所属的目录path
     * @param device_path
     * @param id
     */
    del_device(device_path: string, id: string): Promise<number>;
    /**
     * 根据ip与port远程删除摄像头，device_path是指删除某个目录下的设备，也就是设备所属的目录path
     * @param device_path
     * @param ip
     * @param port
     */
    del_device_by_ip(device_path: string, ip: string, port: number): Promise<void>;
    /**
     * 更新设备信息（摄像头）
     * @param device_path
     * @param params IPCDto
     * @returns
     */
    update_device(device_path: string, params: WCSDEVICEINFO): Promise<number>;
    /**
     * 远程添加摄像头
     * @param device_path
     * @param params IPCDto
     * @returns
     */
    add_device(device_path: string, params: WCSDEVICEINFO): Promise<number>;
    /**
     * 查询设备列表
     * @param device_path
     * @param offset
     * @param count
     * @param device_type
     */
    device_list(device_path: string, offset: number, count: number, verbose?: WCSVERBOSE): Promise<number>;
    /**
     * 查询单个设备信息
     * @param device_path
     * @param verbose
     */
    device_info(device_path: string, verbose?: WCSVERBOSE): Promise<number>;
    /**
     * 搜索设备
     * @param device_path
     * @param device_code
     * @returns
     */
    search_device(device_code: string, device_type?: string): Promise<number>;
    /**
     * 获取指定网关下的设备
     * @param device_path
     * @param offset
     * @param count
     */
    query_devices(device_path: string, offset: number, count: number): Promise<number>;
    /**
     * 获取网关下局域网设备列表
     * @param device_path
     * @param offset
     * @param count
     */
    query_lan_devices(device_path: string, offset: number, count: number): Promise<number>;
    /**
     * 获取指定设备下通道列表
     * @param device_path 网关path 例:/dist_15/link_1/2000000000
     * @param uuid 设备uuid 例:b4dd74da94ac63b96b0a906393ae8c69
     * @param offset
     * @param count
     */
    query_device_channels(device_path: string, uuid: string, offset: number, count: number): Promise<number>;
    /**
     * 主动搜索网关下局域网设备
     * @param device_path
     * @returns
     */
    search_lan_devices(device_path: string): Promise<number>;
}
//# sourceMappingURL=lib.d.ts.map