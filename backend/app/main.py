import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.api.routes import router
from app.api.dashboard import router as dashboard_router
from app.utils.limits import RequestSizeLimit

app = FastAPI(title='DataPilot AI', version='1.0.0', description='Local, transparent data analysis. No external AI service.')
app.add_middleware(RequestSizeLimit)
app.include_router(router)
app.include_router(dashboard_router)


@app.exception_handler(ValueError)
async def invalid_value(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={'detail': str(exc)})


@app.exception_handler(Exception)
async def unexpected(request: Request, exc: Exception):
    logging.exception('Analysis failed', exc_info=exc)
    return JSONResponse(status_code=500, content={'detail': 'Analysis could not complete. Check the file format and backend logs.'})
