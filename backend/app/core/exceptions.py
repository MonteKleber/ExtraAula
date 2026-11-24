import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger("extraaula")


class DomainError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = "DOMAIN_ERROR"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class NotFoundError(DomainError):
    def __init__(self, message: str = "Recurso não encontrado"):
        super().__init__(message, status_code=404, code="NOT_FOUND")


class ForbiddenError(DomainError):
    def __init__(self, message: str = "Sem permissão para executar esta ação"):
        super().__init__(message, status_code=403, code="FORBIDDEN")


class UnauthorizedError(DomainError):
    def __init__(self, message: str = "Credenciais inválidas ou sessão expirada"):
        super().__init__(message, status_code=401, code="UNAUTHORIZED")


class ConflictError(DomainError):
    def __init__(self, message: str = "Conflito de estado ou dado duplicado"):
        super().__init__(message, status_code=409, code="CONFLICT")


class InvalidStateTransitionError(DomainError):
    def __init__(self, current_status: str, target_status: str):
        super().__init__(
            f"Transição de estado inválida: {current_status} -> {target_status}",
            status_code=409,
            code="INVALID_STATE_TRANSITION",
        )


class InsufficientBalanceError(DomainError):
    def __init__(self, required: int, available: int):
        super().__init__(
            f"Saldo insuficiente de tokens. Necessário: {required}, disponível: {available}",
            status_code=400,
            code="INSUFFICIENT_BALANCE",
        )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "code": exc.code},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_request: Request, exc: IntegrityError):
        logger.warning("Database integrity error: %s", exc)
        return JSONResponse(
            status_code=409,
            content={
                "detail": "Violação de integridade no banco de dados (registro duplicado ou referência inválida).",
                "code": "INTEGRITY_ERROR",
            },
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Erro interno do servidor. Tente novamente em instantes.",
                "code": "INTERNAL_SERVER_ERROR",
            },
        )
