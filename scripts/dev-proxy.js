#!/usr/bin/env node
'use strict';
// Cổng vào DUY NHẤT cho dev. Phân biệt thành phần bằng Host header thay vì bằng
// số cổng, để hình trạng lúc dev trùng hình trạng production:
//
//   http://tsudev.localhost:8080        → frontend-main   127.0.0.1:3000
//   http://cdn.tsudev.localhost:8080    → MinIO           127.0.0.1:9000
//
// Lý do ban đầu là để cookie `Domain=.tsudev.localhost` chia sẻ được giữa trang
// chính và diễn đàn. Diễn đàn không còn và Keycloak cũng đã bị gỡ, nhưng proxy
// vẫn giữ vì ba lẽ: subdomain `cdn.` vẫn cần, một cổng vào vẫn tiện, và hình
// trạng dev vẫn khớp production. Không cần nữa thì `DEV_PROXY=0`.
//
// Bảng định tuyến sinh từ config/topology.json. Chạy: node scripts/dev-proxy.js

const http = require('http');
const { loadTopology } = require('./topology/load');

const topo = loadTopology();
const PORT = Number(process.env.DEV_PROXY_PORT || topo.dev.proxyPort);

// Upstream ghi 127.0.0.1 TƯỜNG MINH, không dùng hostname: `*.localhost` phân
// giải ra ::1 trên nhiều máy, để proxy tự phân giải lại tên là mời một vòng DNS
// thừa mỗi lượt và có nguy cơ trỏ ngược vào chính nó.
const ROUTES = new Map(
  topo.nodes
    .filter((n) => n.public)
    .map((n) => [
      n.sub === '@' ? topo.dev.domain : `${n.sub}.${topo.dev.domain}`,
      { id: n.id, label: n.label, port: n.port },
    ])
);

const hostnameOf = (req) =>
  String(req.headers.host || '')
    .split(':')[0]
    .toLowerCase();

// Host trần: gõ `localhost:8080` là nhầm lẫn thường gặp nhất, không phải lỗi
// gõ tên miền. Trả 404 ở đây từng đẩy người dùng đi tìm sang cổng 3000 - nơi
// site có chạy nhưng đăng nhập hỏng trong im lặng vì cookie sai domain. Chuyển
// hướng về host chuẩn cắt đứt cả chuỗi đó.
const BARE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '']);

function redirectToCanonical(res, url) {
  const target = `http://${topo.dev.domain}:${PORT}${url}`;
  res.writeHead(302, { Location: target, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`dev-proxy: host trần không mang được cookie phiên, chuyển tới ${target}\n`);
}

function notFound(res, host) {
  const known = [...ROUTES.keys()].map((h) => `  http://${h}:${PORT}`).join('\n');
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`dev-proxy: không có tuyến cho "${host}"\n\nCác địa chỉ hợp lệ:\n${known}\n`);
}

const server = http.createServer((req, res) => {
  const host = hostnameOf(req);
  const route = ROUTES.get(host);
  if (!route) return BARE_HOSTS.has(host) ? redirectToCanonical(res, req.url) : notFound(res, host);

  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: route.port,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        // Giữ nguyên Host để app phía sau dựng URL tuyệt đối đúng origin công khai.
        'x-forwarded-host': req.headers.host,
        'x-forwarded-proto': 'http',
        'x-forwarded-for': req.socket.remoteAddress,
      },
    },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    }
  );

  upstream.on('error', (err) => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`dev-proxy: ${route.label} (127.0.0.1:${route.port}) không trả lời\n${err.message}\n`);
  });

  req.pipe(upstream);
});

// Next dev đẩy hot-reload qua WebSocket. Quên nhánh upgrade này thì trang vẫn
// chạy nhưng sửa file không tự nạp lại - triệu chứng rất dễ chẩn nhầm thành lỗi
// của Next chứ không phải của proxy.
server.on('upgrade', (req, socket, head) => {
  const route = ROUTES.get(hostnameOf(req));
  if (!route) return socket.destroy();

  const upstream = http.request({
    host: '127.0.0.1',
    port: route.port,
    method: req.method,
    path: req.url,
    headers: req.headers,
  });

  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    // Dữ liệu đã đọc lỡ qua phần header thì đẩy ngược vào đầu socket tương ứng,
    // rồi mới nối hai chiều - bỏ sót bước này là mất frame WebSocket đầu tiên.
    if (upHead && upHead.length) upSocket.unshift(upHead);
    if (head && head.length) socket.unshift(head);

    const headers = Object.entries(upRes.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`);

    upSocket.on('error', () => socket.destroy());
    socket.on('error', () => upSocket.destroy());
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });

  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  upstream.end();
});

// listen() KHÔNG truyền host: Node bind '::' dual-stack, nhận được cả ::1 (thứ
// mà *.localhost phân giải ra) lẫn 127.0.0.1.
server.listen(PORT, () => {
  console.log(`[dev-proxy] cổng ${PORT}`);
  [...ROUTES.entries()].forEach(([host, r]) =>
    console.log(`[dev-proxy]   http://${host}:${PORT}  →  127.0.0.1:${r.port}  (${r.label})`)
  );
});
