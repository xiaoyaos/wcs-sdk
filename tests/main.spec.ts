import { test, expect } from '@playwright/test';
import { WcsSdk } from '../src/lib';

const info = {
  username: 'test123',
  password: 'Test123456',
  wcs_ws_url: 'ws://115.231.10.152:3098/'
}
let wcsSdk: WcsSdk;
test.beforeAll(async ()=>{
  wcsSdk = new WcsSdk(info.username, info.password, info.wcs_ws_url);
  await new Promise((resolve)=>{
    setTimeout(()=>{resolve(1)}, 3000)
  })
})

test.describe.serial('[WCSSDK] 测试', async () => {
  test('[正常测试] 初始化订阅', async () => {
    let paths = ['/dist_10/link_1/2000000000', '/dist_10/link_2/2000000000'];
    await wcsSdk.quickSubscribe(paths);
  });

  test('[正常测试] 注册订阅通知-设备状态', async () => {
    await wcsSdk.quickListenEvent('status_wcs_event', (data) => {
      expect(data.notify).toEqual('device');
      expect(data.event).toEqual('status');
      expect(data.content).toHaveProperty('device_path');
      expect(data.content).toHaveProperty('device_type', 'device/IPC');
      expect(data.content).toHaveProperty('status');
      expect(data.content.status).toBeInstanceOf(Boolean);
    });
  });

  test('[正常测试] 注册订阅通知-添加设备事件', async () => {
    await wcsSdk.quickListenEvent('add_wcs_event', (data) => {
      expect(data.notify).toEqual('device');
      expect(data.event).toEqual('add');
      expect(data.content).toHaveProperty('device_path');
      expect(data.content).toHaveProperty('device_type', 'device/IPC');
    });
  });

  test('[正常测试] 注册订阅通知-删除设备事件', async () => {
    wcsSdk.quickListenEvent('delete_wcs_event', (data) => {console.log(data)
      expect(data.notify).toEqual('device');
      expect(data.event).toEqual('delete');
      expect(data.content).toHaveProperty('device_path');
      expect(data.content).toHaveProperty('device_type', 'device/IPC');
    });
  });
})

