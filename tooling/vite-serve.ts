  // listen 之后 unshift 到栈顶：connect 的路径前缀 use 会被 Vite 的 SPA fallback
  // 抢先（它重建栈），插在最前才保证 /__mode/health 命中。
  server.middlewares.stack.unshift({ route: "", handle: healthHandler });
  if ("middlewares" in server) server.middlewares.stack.unshift({ route: "", handle: healthHandler });