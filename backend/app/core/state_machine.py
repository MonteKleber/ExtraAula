from enum import Enum
from app.core.exceptions import InvalidStateTransitionError


class RequestStatus(str, Enum):
    CRIADA = "CRIADA"
    PROPOSTA_ENVIADA = "PROPOSTA_ENVIADA"
    ACEITA = "ACEITA"
    AGENDADA = "AGENDADA"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    FINALIZADA = "FINALIZADA"
    RECUSADA = "RECUSADA"
    CANCELADA = "CANCELADA"
    EXPIRADA = "EXPIRADA"


ALLOWED_TRANSITIONS: dict[RequestStatus, set[RequestStatus]] = {
    RequestStatus.CRIADA: {
        RequestStatus.PROPOSTA_ENVIADA,
        RequestStatus.CANCELADA,
        RequestStatus.EXPIRADA,
    },
    RequestStatus.PROPOSTA_ENVIADA: {
        RequestStatus.PROPOSTA_ENVIADA,  # counterproposal rounds
        RequestStatus.ACEITA,
        RequestStatus.RECUSADA,
        RequestStatus.CANCELADA,
        RequestStatus.EXPIRADA,
    },
    RequestStatus.ACEITA: {
        RequestStatus.AGENDADA,
        RequestStatus.CANCELADA,
    },
    RequestStatus.AGENDADA: {
        RequestStatus.EM_ANDAMENTO,
        RequestStatus.CANCELADA,
        RequestStatus.EXPIRADA,
    },
    RequestStatus.EM_ANDAMENTO: {
        RequestStatus.FINALIZADA,
        RequestStatus.CANCELADA,
    },
    RequestStatus.FINALIZADA: set(),
    RequestStatus.RECUSADA: set(),
    RequestStatus.CANCELADA: set(),
    RequestStatus.EXPIRADA: set(),
}


def can_transition(current: RequestStatus | str, target: RequestStatus | str) -> bool:
    cur = RequestStatus(current)
    tgt = RequestStatus(target)
    return tgt in ALLOWED_TRANSITIONS[cur]


def assert_transition(current: RequestStatus | str, target: RequestStatus | str) -> RequestStatus:
    cur = RequestStatus(current)
    tgt = RequestStatus(target)
    if tgt not in ALLOWED_TRANSITIONS[cur]:
        raise InvalidStateTransitionError(cur.value, tgt.value)
    return tgt
