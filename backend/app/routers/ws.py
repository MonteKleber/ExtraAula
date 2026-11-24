import asyncio
from collections import defaultdict

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import SessionLocal
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.core.state_machine import RequestStatus
from app.models.models import Message, TutoringSession, User, UserRole
from app.routers.serializers import serialize_message
from app.services.session_service import compute_timer_state

router = APIRouter(tags=["WebSocket Chat"])


class SessionConnectionManager:
    def __init__(self) -> None:
        # session_id -> dict[WebSocket, dict(user_id, name, role)]
        self.rooms: dict[int, dict[WebSocket, dict]] = defaultdict(dict)

    async def connect(self, session_id: int, websocket: WebSocket, user_info: dict) -> None:
        await websocket.accept()
        self.rooms[session_id][websocket] = user_info
        await self.broadcast_presence(session_id)

    async def disconnect(self, session_id: int, websocket: WebSocket) -> None:
        room = self.rooms.get(session_id)
        if room and websocket in room:
            del room[websocket]
            if not room:
                del self.rooms[session_id]
            else:
                await self.broadcast_presence(session_id)

    def online_users(self, session_id: int) -> list[dict]:
        seen: dict[int, dict] = {}
        for info in self.rooms.get(session_id, {}).values():
            seen[info["user_id"]] = info
        return list(seen.values())

    async def broadcast_presence(self, session_id: int) -> None:
        await self.broadcast_json(
            session_id,
            {
                "type": "presence",
                "online_users": self.online_users(session_id),
            },
        )

    async def broadcast_json(self, session_id: int, payload: dict) -> None:
        room = self.rooms.get(session_id)
        if not room:
            return
        dead: list[WebSocket] = []
        for ws in list(room.keys()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            room.pop(ws, None)


manager = SessionConnectionManager()


@router.websocket("/ws/sessions/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(...),
):
    db = SessionLocal()
    try:
        try:
            payload = decode_access_token(token)
            user_id = int(payload["sub"])
        except UnauthorizedError:
            await websocket.close(code=4001, reason="Token inválido")
            return

        user = db.get(User, user_id)
        session = db.get(TutoringSession, session_id)
        if not user or not user.is_active or not session:
            await websocket.close(code=4004, reason="Sessão ou usuário não encontrado")
            return

        if user.role != UserRole.ADMIN and user.id not in (session.student_id, session.teacher_id):
            await websocket.close(code=4003, reason="Sem permissão para esta sala")
            return

        user_info = {"user_id": user.id, "name": user.name, "role": user.role.value}
        await manager.connect(session_id, websocket, user_info)

        # Immediately send authoritative server timer state
        timer_state = compute_timer_state(session)
        await websocket.send_json(
            {"type": "timer_tick", "timer": timer_state.model_dump(mode="json")}
        )
    finally:
        db.close()

    async def timer_heartbeat():
        try:
            while True:
                await asyncio.sleep(1)
                loop_db = SessionLocal()
                try:
                    s = loop_db.get(TutoringSession, session_id)
                    if not s:
                        break
                    t = compute_timer_state(s)
                    await websocket.send_json(
                        {"type": "timer_tick", "timer": t.model_dump(mode="json")}
                    )
                finally:
                    loop_db.close()
        except Exception:
            pass

    heartbeat_task = asyncio.create_task(timer_heartbeat())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "message")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg_type == "message":
                content = str(data.get("content", "")).strip()
                if not content or len(content) > 2000:
                    continue
                msg_db = SessionLocal()
                try:
                    s = msg_db.get(TutoringSession, session_id)
                    if not s or s.status in (RequestStatus.CANCELADA, RequestStatus.EXPIRADA):
                        await websocket.send_json(
                            {"type": "error", "detail": "Esta sessão não aceita novas mensagens."}
                        )
                        continue
                    msg = Message(
                        session_id=session_id,
                        sender_id=user_info["user_id"],
                        content=content,
                    )
                    msg_db.add(msg)
                    msg_db.commit()
                    loaded = msg_db.scalar(
                        select(Message)
                        .where(Message.id == msg.id)
                        .options(joinedload(Message.sender))
                    )
                    serialized = serialize_message(loaded)
                finally:
                    msg_db.close()

                await manager.broadcast_json(
                    session_id,
                    {"type": "message", "message": serialized.model_dump(mode="json")},
                )
    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        await manager.disconnect(session_id, websocket)
