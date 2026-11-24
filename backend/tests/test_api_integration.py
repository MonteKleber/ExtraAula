from app.seed import run_seed


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login(client, email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_seed_and_marketplace_and_qr(client, db_session):
    res_seed = run_seed(db_session)
    assert res_seed["status"] == "seeded"
    assert res_seed["teachers"] == 5
    assert res_seed["students"] == 15
    assert res_seed["subjects"] == 8

    # Idempotent second run
    assert run_seed(db_session)["status"] == "already_seeded"

    # Public marketplace
    r = client.get("/api/marketplace/teachers?available_only=true")
    assert r.status_code == 200
    teachers = r.json()
    assert len(teachers) == 4
    assert all(t["is_available"] for t in teachers)

    # Public QR route
    qr_slug = teachers[0]["qr_code_slug"]
    qr_res = client.get(f"/api/marketplace/qr/{qr_slug}")
    assert qr_res.status_code == 200
    assert qr_res.json()["qr_code_slug"] == qr_slug


def test_auth_register_and_password_recovery(client):
    # Admin registration must be rejected
    bad = client.post(
        "/api/auth/register",
        json={
            "name": "Hacker",
            "email": "hacker@test.com",
            "password": "Password123!",
            "role": "ADMIN",
        },
    )
    assert bad.status_code == 422

    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Novo Aluno",
            "email": "novo@extraaula.com",
            "password": "Password123!",
            "role": "STUDENT",
            "institution": "USP",
        },
    )
    assert reg.status_code == 201
    assert reg.json()["wallet"]["balance"] == 100

    rec = client.post("/api/auth/password-recovery", json={"email": "novo@extraaula.com"})
    assert rec.status_code == 200
    reset_token = rec.json()["demo_reset_token"]
    assert reset_token

    confirm = client.post(
        "/api/auth/password-reset",
        json={"token": reset_token, "new_password": "NewPassword456!"},
    )
    assert confirm.status_code == 200
    _login(client, "novo@extraaula.com", "NewPassword456!")


def test_full_indrive_negotiation_chat_ws_settlement_and_reviews(client, db_session):
    run_seed(db_session)
    student_token = _login(client, "aluno2@extraaula.com", "Aluno123!")
    teacher_token = _login(client, "prof.marina@extraaula.com", "Prof123!")

    # Get subjects and Marina's user_id
    subjects = client.get("/api/subjects").json()
    fisica = next(s for s in subjects if "Física" in s["name"])
    teachers = client.get("/api/marketplace/teachers").json()
    marina = next(t for t in teachers if t["email"] == "prof.marina@extraaula.com")

    wallet_before = client.get("/api/wallet", headers=_auth_header(student_token)).json()["wallet"]

    # 1. Student creates request offering 50 tokens
    req_res = client.post(
        "/api/requests",
        headers=_auth_header(student_token),
        json={
            "subject_id": fisica["id"],
            "service_type": "TIRA_DUVIDAS",
            "title": "Revisão de Leis de Newton",
            "description": "Dúvida nos exercícios 2 e 5 de blocos acoplados.",
            "duration_minutes": 25,
            "offered_tokens": 50,
            "teacher_id": marina["user_id"],
        },
    )
    assert req_res.status_code == 201, req_res.text
    req_data = req_res.json()
    assert req_data["status"] == "PROPOSTA_ENVIADA"

    # 2. Teacher sends InDrive counterproposal of 65 tokens
    counter_res = client.post(
        f"/api/requests/{req_data['id']}/proposals",
        headers=_auth_header(teacher_token),
        json={
            "offered_tokens": 65,
            "message": "Consigo resolver toda a lista por 65 tokens!",
        },
    )
    assert counter_res.status_code == 201, counter_res.text
    counter_id = counter_res.json()["id"]

    # 3. Student accepts counterproposal -> locks 65 tokens & creates session in AGENDADA
    acc_res = client.post(
        f"/api/proposals/{counter_id}/accept",
        headers=_auth_header(student_token),
    )
    assert acc_res.status_code == 200, acc_res.text
    session_data = acc_res.json()
    session_id = session_data["id"]
    assert session_data["status"] == "AGENDADA"
    assert session_data["agreed_tokens"] == 65

    wallet_locked = client.get("/api/wallet", headers=_auth_header(student_token)).json()["wallet"]
    assert wallet_locked["balance"] == wallet_before["balance"] - 65
    assert wallet_locked["locked_balance"] == wallet_before["locked_balance"] + 65

    # Review BEFORE finishing must fail
    early_rev = client.post(
        f"/api/sessions/{session_id}/reviews",
        headers=_auth_header(student_token),
        json={"rating": 5, "comment": "Cedo demais"},
    )
    assert early_rev.status_code == 400

    # 4. Start session
    start_res = client.post(
        f"/api/sessions/{session_id}/start",
        headers=_auth_header(teacher_token),
    )
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "EM_ANDAMENTO"

    # 5. Real-time WebSocket chat & server timer tick
    with client.websocket_connect(f"/ws/sessions/{session_id}?token={student_token}") as ws:
        first_msg = ws.receive_json()
        assert first_msg["type"] in ("presence", "timer_tick")
        ws.send_json({"type": "message", "content": "Olá Profa., tudo pronto!"})
        received_chat = False
        for _ in range(5):
            pkt = ws.receive_json()
            if pkt.get("type") == "message":
                assert pkt["message"]["content"] == "Olá Profa., tudo pronto!"
                received_chat = True
                break
        assert received_chat

    # History persisted via REST
    msgs = client.get(
        f"/api/sessions/{session_id}/messages", headers=_auth_header(teacher_token)
    ).json()
    assert any(m["content"] == "Olá Profa., tudo pronto!" for m in msgs)

    # 6. Finish session -> server bills & settles tokens
    fin_res = client.post(
        f"/api/sessions/{session_id}/finish",
        headers=_auth_header(teacher_token),
    )
    assert fin_res.status_code == 200
    fin = fin_res.json()
    assert fin["status"] == "FINALIZADA"
    assert fin["charged_tokens"] >= 1
    assert fin["teacher_net_tokens"] + fin["platform_fee_tokens"] == fin["charged_tokens"]

    # 7. Reviews allowed once per participant
    rev_s = client.post(
        f"/api/sessions/{session_id}/reviews",
        headers=_auth_header(student_token),
        json={"rating": 5, "comment": "Excelente aula!"},
    )
    assert rev_s.status_code == 201

    # Duplicate review blocked
    rev_dup = client.post(
        f"/api/sessions/{session_id}/reviews",
        headers=_auth_header(student_token),
        json={"rating": 4, "comment": "Duplicada"},
    )
    assert rev_dup.status_code == 409

    # Teacher reviews student
    rev_t = client.post(
        f"/api/sessions/{session_id}/reviews",
        headers=_auth_header(teacher_token),
        json={"rating": 5, "comment": "Ótima aluna!"},
    )
    assert rev_t.status_code == 201


def test_admin_rbac_and_overview(client, db_session):
    run_seed(db_session)
    student_token = _login(client, "aluno1@extraaula.com", "Aluno123!")
    admin_token = _login(client, "admin@extraaula.com", "Admin123!")

    # Student cannot access admin overview
    forbidden = client.get("/api/admin/overview", headers=_auth_header(student_token))
    assert forbidden.status_code == 403

    # Admin gets KPIs
    ov = client.get("/api/admin/overview", headers=_auth_header(admin_token))
    assert ov.status_code == 200
    data = ov.json()
    assert data["total_students"] == 15
    assert data["total_teachers"] == 5
    assert data["available_teachers"] == 4
    assert data["total_sessions_completed"] >= 6
    assert data["platform_commission_tokens"] > 0

    # Admin creates new subject
    sub = client.post(
        "/api/subjects",
        headers=_auth_header(admin_token),
        json={"name": "Inteligência Artificial", "category": "Computação", "description": "ML e LLMs"},
    )
    assert sub.status_code == 201
