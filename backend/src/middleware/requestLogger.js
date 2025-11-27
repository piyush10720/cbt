/**
 * Request logging middleware
 * Logs every incoming request with method, path, and outcome (success/error)
 */

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log incoming request
  console.log('\n' + '='.repeat(80));
  console.log(`[${new Date().toISOString()}] [REQUEST] [ID: ${requestId}]`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`Full URL: ${req.originalUrl}`);
  console.log(`IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`User-Agent: ${req.get('user-agent') || 'N/A'}`);
  
  // Log request body for non-GET requests (excluding sensitive data)
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    // Hide sensitive fields
    if (sanitizedBody.password) sanitizedBody.password = '***HIDDEN***';
    if (sanitizedBody.token) sanitizedBody.token = '***HIDDEN***';
    console.log(`Body:`, JSON.stringify(sanitizedBody, null, 2));
  }
  
  // Log query parameters
  if (req.query && Object.keys(req.query).length > 0) {
    console.log(`Query:`, JSON.stringify(req.query, null, 2));
  }
  
  // Store original res.json and res.send to intercept response
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  
  // Track if response was already logged
  let responseLogged = false;
  
  const logResponse = (statusCode, body) => {
    if (responseLogged) return;
    responseLogged = true;
    
    const duration = Date.now() - startTime;
    const isSuccess = statusCode >= 200 && statusCode < 400;
    const status = isSuccess ? 'SUCCESS' : 'ERROR';
    
    console.log('-'.repeat(80));
    console.log(`[${new Date().toISOString()}] [RESPONSE] [ID: ${requestId}]`);
    console.log(`Status: ${status} (${statusCode})`);
    console.log(`Duration: ${duration}ms`);
    
    // Log response body for errors or if it's small enough
    if (!isSuccess) {
      console.log(`Response Body:`, typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    }
    
    console.log('='.repeat(80) + '\n');
  };
  
  // Override res.json
  res.json = function(body) {
    logResponse(res.statusCode, body);
    return originalJson(body);
  };
  
  // Override res.send
  res.send = function(body) {
    logResponse(res.statusCode, body);
    return originalSend(body);
  };
  
  // Handle response finish event (fallback for other response methods)
  res.on('finish', () => {
    if (!responseLogged) {
      logResponse(res.statusCode, 'Response sent without json/send');
    }
  });
  
  next();
};

// Error logging middleware - should be used after routes
const errorLogger = (err, req, res, next) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('\n' + '!'.repeat(80));
  console.log(`[${new Date().toISOString()}] [ERROR] [ID: ${requestId}]`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`Error Name: ${err.name}`);
  console.log(`Error Message: ${err.message}`);
  console.log(`Stack Trace:`);
  console.log(err.stack);
  console.log('!'.repeat(80) + '\n');
  
  // Pass to next error handler
  next(err);
};

module.exports = { requestLogger, errorLogger };
