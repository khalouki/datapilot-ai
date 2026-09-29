from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Scope, Receive, Send


class RequestSizeLimit:
    """Bound multipart bodies before parsing, including chunked uploads."""
    def __init__(self, app: ASGIApp, maximum: int = 11 * 1024 * 1024):
        self.app, self.maximum = app, maximum

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope['type'] != 'http' or scope['method'] not in ('POST', 'PUT', 'PATCH'):
            return await self.app(scope, receive, send)
        chunks = []
        total = 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            total += len(message.get('body', b''))
            if total > self.maximum:
                response = JSONResponse(status_code=413, content={'detail': 'Request exceeds the 10 MB file upload limit.'})
                return await response(scope, receive, send)
            chunks.append(message)
            if not message.get('more_body', False):
                break
        index = 0

        async def bounded_receive():
            nonlocal index
            if index < len(chunks):
                message = chunks[index]
                index += 1
                return message
            return await receive()

        await self.app(scope, bounded_receive, send)
