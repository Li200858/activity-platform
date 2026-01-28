// Cloudflare Worker代理脚本
// 部署到Cloudflare Workers来代理Render后端API

export default {
  async fetch(request, env, ctx) {
    // 你的Render后端URL - 请替换为实际的后端地址
    const BACKEND_URL = 'https://activity-registration-backend.onrender.com';
    
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    
    try {
      // 获取请求URL
      const url = new URL(request.url);
      
      // 构建后端URL
      const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      
      // 创建请求头（移除可能引起问题的头）
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('cf-connecting-ip');
      headers.delete('cf-ray');
      
      // 创建新请求
      const newRequest = new Request(backendUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });
      
      // 发送请求到后端
      const response = await fetch(newRequest);
      
      // 获取响应体
      const responseBody = await response.text();
      
      // 创建响应并添加CORS头
      const newResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
      
      return newResponse;
    } catch (error) {
      // 错误处理
      return new Response(JSON.stringify({ 
        error: '代理请求失败', 
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }
}



