import http from 'http';

const PORT = 8081;

const mockServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const parsedBody = body ? JSON.parse(body) : {};
    console.log(`[Mock Upstream] Received ${req.method} ${req.url}`);

    if (req.url === '/v1/chat/completions') {
      const isStreaming = parsedBody.stream === true;
      if (isStreaming) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello from mock GPT-4o!"},"finish_reason":null}]}\n\n');
        res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":25000,"completion_tokens":15000,"total_tokens":40000}}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-2',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4o',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from mock GPT-4o (non-streaming)!' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 12000, completion_tokens: 8000, total_tokens: 20000 }
        }));
      }
    } else if (req.url === '/v1/messages') {
      const isStreaming = parsedBody.stream === true;
      if (isStreaming) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-3-5-sonnet-20241022","content":[],"usage":{"input_tokens":15000,"output_tokens":0}}}\n\n');
        res.write('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi there from mock Claude 3.5 Sonnet!"}}\n\n');
        res.write('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":25000}}\n\n');
        res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hi there from mock Claude 3.5 Sonnet (non-streaming)!' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 8000, output_tokens: 12000 }
        }));
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
});

mockServer.listen(PORT, () => {
  console.log(`✅ Standalone Mock Upstream Server running on port ${PORT}`);
});
