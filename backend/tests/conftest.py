import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session, monkeypatch):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Ensure WebSocket handler uses the same in-memory test DB session factory
    from app import main as main_module
    from app.routers import ws as ws_module

    monkeypatch.setattr(main_module.settings, "AUTO_SEED", False)

    class _NoCloseSessionProxy:
        def __init__(self, wrapped):
            self._wrapped = wrapped

        def __getattr__(self, item):
            return getattr(self._wrapped, item)

        def close(self):
            pass

    monkeypatch.setattr(ws_module, "SessionLocal", lambda: _NoCloseSessionProxy(db_session))

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
