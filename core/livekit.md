---
description: '为栖梧员工前台音视频部署 LiveKit：HTTPS/WSS、TURN、端口、后端密钥、浏览器 CSP、禁止自动建房、故障清理与真实服务验收。'
---

# LiveKit 接入与部署

栖梧负责员工身份、租户和成员资格、邀请、接听、挂断及通话历史；LiveKit 负责音视频媒体。Web/H5 使用官方 JavaScript SDK，App 使用官方 Swift/Android SDK 的 uni-app 原生桥。语音消息走现有聊天附件链路，不依赖 LiveKit。

本版支持前台一对一和含本人最多 8 人的小群通话。没有后台接听、离线推送、屏幕共享或录制；8 人是业务上限，不是服务器容量承诺。无需 GPU 或语音模型服务。

::: warning 需要部署方完成验收
没有预置的可用媒体服务，也没有真实 LiveKit/TURN 或 Android/iPhone 硬件通话的通过记录。源码构建、模拟器测试与插件链接不能证明现场媒体可达。发布前完成[接入验收](#接入验收)，App 还须处理[原生包和许可条件](/features/im#app-要求与验收)。
:::

## 服务和网络

当前支持的自托管服务端固定为 **v1.13.11**。在 Linux 上安装该版本官方二进制，用非 root 服务账号和系统服务管理器运行：

```sh
livekit-server --config /etc/livekit/livekit.yaml
```

服务账号只能读取受保护的配置和证书。以下是单节点配置结构，示例域名和尖括号占位值必须替换为部署方自己的配置，不要提交真实密钥：

```yaml
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
room:
  auto_create: false
keys:
  <generated-api-key>: <generated-random-secret>
turn:
  enabled: true
  domain: turn.example.com
  tls_port: 443
  udp_port: 3478
  cert_file: /etc/livekit/tls/fullchain.pem
  key_file: /etc/livekit/tls/privkey.pem
```

**必须保留 `room.auto_create: false`。** 房间由业务服务端按当前成员资格显式创建，普通客户端不能自动新建。升级媒体服务版本前重新核对配置和删除后旧票据的行为。

- `media.example.com` 使用受信任的 HTTPS/WSS 证书，7880 放在 TLS 反向代理后，不向公网暴露明文控制 API。
- 示例媒体网络使用 UDP mux 7882、TCP 7881；TURN 使用 TCP 443、UDP 3478。若改用 UDP 端口范围，按实际配置放行该范围。
- 示例 TURN/TLS 使用独立公网 IP 的 `turn.example.com:443`，避免与相同 IP 的 HTTPS 监听冲突。直接以非 root 监听 443 时，Linux 服务只授予所需的 `CAP_NET_BIND_SERVICE`；也可在独立四层负载均衡器后监听高位端口。
- NAT 后节点公布的公网地址和端口必须实际可达。TCP/TURN 是受限网络的回退路径，仍须在目标网络测试。

带宽与 CPU 按参与者上行、订阅数和画质测量。官方资料：[自托管部署](https://docs.livekit.io/transport/self-hosting/deployment/) · [端口与防火墙](https://docs.livekit.io/transport/self-hosting/ports-firewall/)。

## 应用服务配置

非秘密配置写在应用服务器的环境配置中：

```dotenv
APP_IM=true
IM_LIVEKIT_URL=wss://media.example.com
IM_LIVEKIT_API_URL=https://media.example.com
```

| 配置 | 用途 |
| --- | --- |
| `IM_LIVEKIT_URL` | 员工客户端连接的 WSS 源 |
| `IM_LIVEKIT_API_URL` | 应用服务器访问的 HTTPS 控制源 |
| `IM_LIVEKIT_API_KEY` / `IM_LIVEKIT_API_SECRET` | 与媒体服务器 keys 对应，只放应用服务端的 `.env.local` 或受保护环境变量 |
| `OUTBOUND_LIVEKIT_PORTS` | 必须使用非默认公网控制端口时显式登记；默认允许 443 |
| `im.call.enabled` | 系统参数，默认 `false`；媒体配置齐全后允许新通话 |

两个地址只接受源，不带用户信息、路径、查询串或片段。生产用 HTTPS/WSS；HTTP/WS 的 loopback 只用于本机开发。控制面沿用公网目标和 DNS 重绑定防护；不要为了接入通话在生产全局打开 `ALLOW_PRIVATE_ENDPOINTS`。

**不要把服务端 API key/secret 放进 `VITE_*`、App manifest、页面参数、前端包或日志。** 员工客户端只取得当前业务允许的临时房间票据。配置不齐时不发票据，`GET /api/im/options` 会报告是否配置。

## 反向代理和 CSP

为媒体源转发 WebSocket upgrade，关闭 `/rtc` 的请求 URL 日志。官方 SDK 的信令握手可能在查询串携带临时票据；TLS、代理和错误采集不能把完整 URL、Authorization 或响应正文写入日志。

```nginx
location /rtc {
    access_log off;
    proxy_pass http://127.0.0.1:7880;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
}
```

控制 API 同样代理到 LiveKit，由应用服务器的管理授权保护；可额外把 `/twirp/` 限制到可信应用节点 IP。

构建电脑端时设置 `CSP_CONNECT_SRC=https://media.example.com,wss://media.example.com`，使用 S3 时保留它需要的源，按[部署指南](/guide/deploy)同步完整 CSP。保留 `script-src 'self'` 和 `media-src 'self' blob:`；不要用通配符放开脚本。Web/H5 采集还要求安全上下文与本人授权。App 构建使用手机可达的 `VITE_API_BASE=https://api.example.com/api`。

## 挂断与故障处理

临时客户端票据仅允许指定房间、麦克风/摄像头发布和订阅，新入场有效期为 60 秒。票据过期不会自动断开已经连接的媒体；本地断开也不等于远端清理已经完成。

后台维护在 `all`、`api`、`worker` 角色上持续装配；关闭 `APP_IM` 或 `im.call.enabled` 仍要清理存量通话。控制面失败时保留待清理状态；未知的房间创建结果不能盲目重试，也不能凭一次“找不到房间”假定已经结束。恢复网络后继续查询和删除。

更换控制地址、切换集群或轮换/移除控制凭据前：先关闭新通话，等待全部存量和未知创建清空，再变更配置。不要直接把数据库的 Ending 状态改成 Ended，也不要复用旧媒体房间名。存在待清理通话而缺少控制凭据时，应用启动会明确失败。

## 接入验收

在自己的环境完成以下检查并保留结果：

- [ ] HTTPS/WSS、证书链、DNS、应用服务端和各客户端访问均正常。
- [ ] Web、Android、iPhone 双向语音与摄像头画面互通；麦克风/摄像头权限拒绝可以恢复。
- [ ] 语音消息互播、扬声器/耳机、前后镜头、系统中断和视频视图重建正常。
- [ ] Wi-Fi、蜂窝和禁 UDP 的网络分别验证；确认受限网络确实通过 TURN 传输，测试断网与重连。
- [ ] 挂断、退出、被踢、成员移除和切后台停止采集；媒体服务中断时记录清理和重试结果。
- [ ] 保持 `room.auto_create: false` 和普通客户端无创建权限，使用仍有效的旧票据，在成功 DeleteRoom 后重连同一媒体名必须失败；确认没有迟到创建。
- [ ] Android 原生依赖的分发授权已澄清，双平台许可与第三方声明存在于最终应用包；宿主已签名安装并完成真机检查。

当前这些现场结果仍未验收。故障网络下不承诺远端媒体瞬时撤销；单元测试和数据库状态不能代替真实服务检查。

进一步说明：[员工聊天与通话](/features/im) · [移动端开发](/core/mobile) · [源码配置说明](https://github.com/732124645/qiwu-vue-admin/blob/v1.16.0/docs/livekit.md)。
