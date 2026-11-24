import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.exceptions import register_exception_handlers
from app.routers import (
    admin,
    auth,
    marketplace,
    notifications,
    requests,
    sessions,
    subjects,
    teachers,
    wallet,
    ws,
)
from app.seed import run_seed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("extraaula")
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.AUTO_SEED:
        db = SessionLocal()
        try:
            res = run_seed(db)
            logger.info("Auto-seed startup status: %s", res.get("status"))
        except Exception as exc:
            logger.warning("Auto-seed skipped due to error: %s", exc)
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Plataforma EdTech sob demanda conectando alunos a professores com "
        "negociação estilo InDrive em tokens, carteira em garantia (escrow), "
        "chat em tempo real via WebSockets e QR Code direto."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(subjects.router)
app.include_router(marketplace.router)
app.include_router(teachers.router)
app.include_router(requests.router)
app.include_router(sessions.router)
app.include_router(wallet.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(ws.router)


@app.get("/api/health", tags=["Sistema"])
def healthcheck():
    return {"status": "ok", "service": settings.APP_NAME, "env": settings.APP_ENV}
