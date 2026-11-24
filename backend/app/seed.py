"""
Seed de demonstração idempotente para o ExtraAula.
Cria:
- 1 administrador
- 5 professores (com disciplinas, horários, QR Codes únicos e avaliações)
- 15 alunos (com perfis acadêmicos e carteiras de tokens)
- 8 disciplinas
- Solicitações em múltiplos estados (PROPOSTA_ENVIADA, AGENDADA, EM_ANDAMENTO, FINALIZADA, RECUSADA, CANCELADA, EXPIRADA)
- Propostas aceitas, pendentes (com contrapropostas) e recusadas
- Sessões concluídas, agendadas e canceladas com transações ACID consistentes e avaliações
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.core.state_machine import RequestStatus
from app.models.models import (
    AvailabilitySlot,
    Message,
    Notification,
    Proposal,
    ProposalStatus,
    Review,
    ServiceRequest,
    ServiceType,
    StudentProfile,
    Subject,
    TeacherProfile,
    TeacherSubject,
    TutoringSession,
    User,
    UserRole,
)
from app.services.session_service import create_review
from app.services.wallet_service import (
    get_or_create_wallet,
    lock_escrow,
    refund_session_escrow,
    settle_session_escrow,
    top_up_wallet,
)
from app.schemas.schemas import ReviewCreate


def _avatar(name: str, bg: str = "4f46e5") -> str:
    return f"https://api.dicebear.com/9.x/initials/svg?seed={name.replace(' ', '+')}&backgroundColor={bg}"


def run_seed(db: Session) -> dict:
    existing_admin = db.scalar(select(User).where(User.email == "admin@extraaula.com"))
    if existing_admin:
        return {"status": "already_seeded"}

    now = datetime.now(timezone.utc)

    # 1. Disciplinas (8)
    subjects_data = [
        ("Cálculo I & II", "calculo-i-ii", "Exatas", "Limites, derivadas, integrais e séries."),
        ("Algoritmos e Estruturas de Dados", "algoritmos-ed", "Computação", "Complexidade, grafos, árvores e programação dinâmica."),
        ("Física Mecânica", "fisica-mecanica", "Exatas", "Cinemática, leis de Newton, trabalho e energia."),
        ("Banco de Dados & SQL", "banco-dados-sql", "Computação", "Modelagem relacional, normalização, índices e SQL avançado."),
        ("Química Geral", "quimica-geral", "Ciências", "Estequiometria, ligações químicas e equilíbrio."),
        ("Engenharia de Software", "engenharia-software", "Computação", "Arquitetura limpa, testes, APIs REST e carreira tech."),
        ("Estatística & Probabilidade", "estatistica-prob", "Exatas", "Distribuições, inferência estatística e análise de dados."),
        ("Mentoria de Carreira & TCC", "mentoria-carreira-tcc", "Carreira", "Revisão de portfólio, entrevistas técnicas e orientação de TCC."),
    ]
    subjects: dict[str, Subject] = {}
    for name, slug, cat, desc in subjects_data:
        s = Subject(name=name, slug=slug, category=cat, description=desc, is_active=True)
        db.add(s)
        subjects[slug] = s
    db.flush()

    # 2. Administrador (1)
    admin = User(
        name="Beatriz Nogueira",
        email="admin@extraaula.com",
        password_hash=hash_password("Admin123!"),
        role=UserRole.ADMIN,
        avatar_url=_avatar("Beatriz Nogueira", "0f172a"),
    )
    db.add(admin)
    db.flush()
    get_or_create_wallet(db, admin.id)

    # 3. Professores (5)
    teachers_spec = [
        {
            "name": "Profa. Dra. Ana Clara Monteiro",
            "email": "prof.ana@extraaula.com",
            "headline": "Doutora em Matemática Aplicada | Especialista em Cálculo & Estatística",
            "bio": "Mais de 9 anos ajudando universitários a destravar Cálculo, Álgebra e Estatística com resolução passo a passo focada em provas.",
            "education": "Doutorado em Matemática Aplicada - USP",
            "exp": 9,
            "avg_tokens": 70,
            "available": True,
            "qr": "ana-monteiro-calc",
            "bg": "4f46e5",
            "subjects": [
                ("calculo-i-ii", "Integrais múltiplas e EDOs"),
                ("estatistica-prob", "Inferência e R/Python"),
            ],
            "slots": [(0, "14:00", "20:00"), (2, "14:00", "20:00"), (4, "09:00", "17:00")],
        },
        {
            "name": "Prof. Carlos Eduardo Lima",
            "email": "prof.carlos@extraaula.com",
            "headline": "Staff Engineer & Professor de Algoritmos, SQL e Arquitetura",
            "bio": "Engenheiro de Software sênior com experiência em grandes marketplaces. Ajudo em estruturas de dados, bancos relacionais e entrevistas técnicas.",
            "education": "Mestrado em Ciência da Computação - UNICAMP",
            "exp": 11,
            "avg_tokens": 85,
            "available": True,
            "qr": "carlos-lima-dev",
            "bg": "0284c7",
            "subjects": [
                ("algoritmos-ed", "Grafos, DP e LeetCode"),
                ("banco-dados-sql", "PostgreSQL, tuning e modelagem"),
                ("engenharia-software", "FastAPI, React e System Design"),
            ],
            "slots": [(1, "18:00", "22:00"), (3, "18:00", "22:00"), (5, "10:00", "16:00")],
        },
        {
            "name": "Profa. Marina Oliveira",
            "email": "prof.marina@extraaula.com",
            "headline": "Mestre em Física Teórica | Didática visual para Engenharia",
            "bio": "Física descomplicada para estudantes de Engenharia e Ciências Exatas. Listas de exercícios, laboratórios e revisão expressa.",
            "education": "Mestrado em Física - UFRJ",
            "exp": 6,
            "avg_tokens": 55,
            "available": True,
            "qr": "marina-oliveira-fis",
            "bg": "059669",
            "subjects": [
                ("fisica-mecanica", "Mecânica clássica e dinâmica"),
                ("calculo-i-ii", "Cálculo vetorial aplicado"),
            ],
            "slots": [(0, "09:00", "13:00"), (1, "14:00", "19:00"), (3, "14:00", "19:00")],
        },
        {
            "name": "Prof. Rafael Vasconcelos",
            "email": "prof.rafael@extraaula.com",
            "headline": "Tech Lead & Mentor de Carreira, TCC e Engenharia de Software",
            "bio": "Mentoria prática para transição de carreira, revisão de arquitetura de TCC, code review e preparação para processos seletivos.",
            "education": "MBA em Arquitetura de Software - FIAP",
            "exp": 8,
            "avg_tokens": 90,
            "available": True,
            "qr": "rafael-vasconcelos-mentor",
            "bg": "7c3aed",
            "subjects": [
                ("engenharia-software", "Clean Architecture e Testes"),
                ("mentoria-carreira-tcc", "Portfólio, LinkedIn e banca de TCC"),
            ],
            "slots": [(2, "19:00", "22:30"), (4, "18:00", "21:30"), (5, "09:00", "14:00")],
        },
        {
            "name": "Profa. Juliana Ferreira",
            "email": "prof.juliana@extraaula.com",
            "headline": "Química Industrial & Professora de Química Geral e Estatística",
            "bio": "Atendimento acolhedor e objetivo para quem precisa vencer listas de Química Geral e Probabilidade em poucos encontros.",
            "education": "Mestrado em Química - UFMG",
            "exp": 5,
            "avg_tokens": 50,
            "available": False,
            "qr": "juliana-ferreira-quim",
            "bg": "d97706",
            "subjects": [
                ("quimica-geral", "Termoquímica e equilíbrio"),
                ("estatistica-prob", "Estatística experimental"),
            ],
            "slots": [(1, "08:00", "12:00"), (4, "13:00", "17:00")],
        },
    ]

    teachers: list[User] = []
    teacher_pw = hash_password("Prof123!")
    for spec in teachers_spec:
        u = User(
            name=spec["name"],
            email=spec["email"],
            password_hash=teacher_pw,
            role=UserRole.TEACHER,
            avatar_url=_avatar(spec["name"], spec["bg"]),
        )
        db.add(u)
        db.flush()
        tp = TeacherProfile(
            user_id=u.id,
            headline=spec["headline"],
            bio=spec["bio"],
            education=spec["education"],
            experience_years=spec["exp"],
            avg_tokens_per_session=spec["avg_tokens"],
            is_available=spec["available"],
            qr_code_slug=spec["qr"],
        )
        db.add(tp)
        db.flush()
        for slug, note in spec["subjects"]:
            db.add(
                TeacherSubject(
                    teacher_profile_id=tp.id,
                    subject_id=subjects[slug].id,
                    specialty_note=note,
                )
            )
        for dow, start_t, end_t in spec["slots"]:
            db.add(
                AvailabilitySlot(
                    teacher_profile_id=tp.id,
                    day_of_week=dow,
                    start_time=start_t,
                    end_time=end_t,
                    is_active=True,
                )
            )
        get_or_create_wallet(db, u.id)
        teachers.append(u)

    # 4. Alunos (15)
    students_spec = [
        ("Lucas Andrade", "USP", "Engenharia de Computação", "4º semestre", 450),
        ("Mariana Costa", "UNICAMP", "Ciência da Computação", "3º semestre", 380),
        ("Pedro Henrique Silva", "UFMG", "Engenharia Mecânica", "2º semestre", 300),
        ("Gabriela Mendes", "UFRJ", "Sistemas de Informação", "6º semestre", 520),
        ("Thiago Barbosa", "UFSC", "Engenharia Civil", "5º semestre", 250),
        ("Camila Rocha", "PUC-SP", "Ciência de Dados", "4º semestre", 410),
        ("Mateus Almeida", "UNESP", "Física", "3º semestre", 220),
        ("Larissa Teixeira", "UFPR", "Química", "2º semestre", 310),
        ("Felipe Nascimento", "FIAP", "Engenharia de Software", "7º semestre", 600),
        ("Isabela Duarte", "UFBA", "Matemática Aplicada", "5º semestre", 290),
        ("Bruno Carvalho", "UFRGS", "Engenharia Elétrica", "4º semestre", 340),
        ("Fernanda Azevedo", "Mackenzie", "Análise e Desenv. de Sistemas", "3º semestre", 270),
        ("Gustavo Ribeiro", "UTFPR", "Engenharia de Produção", "6º semestre", 360),
        ("Sofia Martins", "UNB", "Estatística", "4º semestre", 400),
        ("Vinícius Gomes", "UFPE", "Ciência da Computação", "8º semestre", 480),
    ]

    students: list[User] = []
    student_pw = hash_password("Aluno123!")
    for idx, (name, inst, course, sem, initial_tokens) in enumerate(students_spec, start=1):
        u = User(
            name=name,
            email=f"aluno{idx}@extraaula.com",
            password_hash=student_pw,
            role=UserRole.STUDENT,
            avatar_url=_avatar(name, "6366f1"),
        )
        db.add(u)
        db.flush()
        db.add(
            StudentProfile(
                user_id=u.id,
                institution=inst,
                course=course,
                semester=sem,
                bio=f"Estudante de {course} na {inst}.",
            )
        )
        top_up_wallet(
            db,
            user_id=u.id,
            amount=initial_tokens,
            description="Saldo inicial demonstrativo de tokens",
            idempotency_key=f"seed:topup:student:{idx}",
        )
        students.append(u)

    db.flush()

    # Helper to seed a completed session with messages, ACID settlement & reviews
    def seed_completed_session(
        student: User,
        teacher: User,
        subject_slug: str,
        service_type: ServiceType,
        title: str,
        desc: str,
        duration_min: int,
        initial_offer: int,
        agreed_tokens: int,
        days_ago: int,
        student_rating: int,
        student_comment: str,
        teacher_rating: int,
        teacher_comment: str,
        chat_lines: list[tuple[str, str]],
    ) -> TutoringSession:
        created = now - timedelta(days=days_ago, hours=2)
        started = now - timedelta(days=days_ago, hours=1)
        ended = started + timedelta(minutes=duration_min)

        req = ServiceRequest(
            student_id=student.id,
            teacher_id=teacher.id,
            subject_id=subjects[subject_slug].id,
            service_type=service_type,
            title=title,
            description=desc,
            duration_minutes=duration_min,
            offered_tokens=agreed_tokens,
            agreed_tokens=agreed_tokens,
            proposed_scheduled_at=started,
            status=RequestStatus.FINALIZADA,
            created_at=created,
        )
        db.add(req)
        db.flush()

        # Proposals history
        if initial_offer != agreed_tokens:
            db.add(
                Proposal(
                    request_id=req.id,
                    sender_id=student.id,
                    teacher_id=teacher.id,
                    offered_tokens=initial_offer,
                    message="Oferta inicial do aluno.",
                    status=ProposalStatus.SUPERSEDED,
                    created_at=created,
                )
            )
            db.add(
                Proposal(
                    request_id=req.id,
                    sender_id=teacher.id,
                    teacher_id=teacher.id,
                    offered_tokens=agreed_tokens,
                    suggested_datetime=started,
                    message="Consigo atender no horário com revisão completa por esse valor.",
                    status=ProposalStatus.ACCEPTED,
                    created_at=created + timedelta(minutes=8),
                )
            )
        else:
            db.add(
                Proposal(
                    request_id=req.id,
                    sender_id=student.id,
                    teacher_id=teacher.id,
                    offered_tokens=agreed_tokens,
                    suggested_datetime=started,
                    message="Oferta inicial aceita diretamente.",
                    status=ProposalStatus.ACCEPTED,
                    created_at=created,
                )
            )

        sess = TutoringSession(
            request_id=req.id,
            student_id=student.id,
            teacher_id=teacher.id,
            subject_id=subjects[subject_slug].id,
            status=RequestStatus.FINALIZADA,
            agreed_tokens=agreed_tokens,
            planned_duration_minutes=duration_min,
            scheduled_at=started,
            started_at=started,
            ended_at=ended,
            actual_duration_seconds=duration_min * 60,
            created_at=created + timedelta(minutes=10),
        )
        db.add(sess)
        db.flush()

        lock_escrow(
            db,
            student_id=student.id,
            amount=agreed_tokens,
            request_id=req.id,
            session_id=sess.id,
            idempotency_key=f"seed:lock:sess:{sess.id}",
        )
        charged, fee, net = settle_session_escrow(db, sess, agreed_tokens)
        sess.charged_tokens = charged
        sess.platform_fee_tokens = fee
        sess.teacher_net_tokens = net

        tp = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == teacher.id))
        if tp:
            tp.completed_sessions_count += 1

        for idx_m, (who, text) in enumerate(chat_lines):
            sender_id = student.id if who == "S" else teacher.id
            db.add(
                Message(
                    session_id=sess.id,
                    sender_id=sender_id,
                    content=text,
                    created_at=started + timedelta(minutes=idx_m * 3 + 1),
                )
            )
        db.flush()

        create_review(db, sess.id, student, ReviewCreate(rating=student_rating, comment=student_comment))
        create_review(db, sess.id, teacher, ReviewCreate(rating=teacher_rating, comment=teacher_comment))
        return sess

    # 5. Sessões concluídas (6 sessões ricas)
    seed_completed_session(
        student=students[0],
        teacher=teachers[0],
        subject_slug="calculo-i-ii",
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Integração por partes e frações parciais",
        desc="Preciso revisar 4 exercícios de integração antes da P2 de Cálculo II.",
        duration_min=30,
        initial_offer=55,
        agreed_tokens=65,
        days_ago=6,
        student_rating=5,
        student_comment="Didática impecável! Finalmente entendi como escolher u e dv sem errar.",
        teacher_rating=5,
        teacher_comment="Aluno muito dedicado e já trouxe as dúvidas bem organizadas.",
        chat_lines=[
            ("S", "Olá Profa. Ana! Estou travado na integral de x² * e^x dx."),
            ("T", "Oi Lucas! Ótima questão. Pela regra LIATE, vamos escolher u = x² e dv = e^x dx."),
            ("S", "Entendi! Então aplicamos duas vezes até zerar o polinômio, certo?"),
            ("T", "Exatamente! Resultado final: e^x (x² - 2x + 2) + C. Vamos testar o próximo exercício."),
        ],
    )

    seed_completed_session(
        student=students[1],
        teacher=teachers[1],
        subject_slug="algoritmos-ed",
        service_type=ServiceType.MENTORIA_PROFISSIONAL,
        title="Otimização de Dijkstra e Programação Dinâmica",
        desc="Preparação para entrevista técnica de estágio em backend.",
        duration_min=60,
        initial_offer=80,
        agreed_tokens=90,
        days_ago=5,
        student_rating=5,
        student_comment="Prof. Carlos explicou complexidade O((V+E) log V) com clareza absurda.",
        teacher_rating=5,
        teacher_comment="Excelente raciocínio lógico, pronta para a entrevista!",
        chat_lines=[
            ("S", "Oi Prof. Carlos! Minha implementação de Dijkstra está dando TLE."),
            ("T", "Olá Mariana! Você está usando heapq (fila de prioridade) e ignorando nós já visitados com distância menor?"),
            ("S", "Ah! Eu não estava checando `if dist > best[u]: continue`!"),
            ("T", "Isso reduz drasticamente as iterações redundantes. Vamos testar no caso de grafo denso."),
        ],
    )

    seed_completed_session(
        student=students[2],
        teacher=teachers[2],
        subject_slug="fisica-mecanica",
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Plano inclinado com atrito e polias",
        desc="Dúvida na decomposição de forças na lista 3 de Física I.",
        duration_min=25,
        initial_offer=50,
        agreed_tokens=50,
        days_ago=4,
        student_rating=5,
        student_comment="Muito paciente e direta ao ponto. Recomendo demais!",
        teacher_rating=5,
        teacher_comment="Ótima participação durante o tira-dúvidas.",
        chat_lines=[
            ("S", "Oi Profa. Marina, sempre confundo o sinal da força de atrito no plano inclinado."),
            ("T", "Oi Pedro! Pense sempre na tendência de movimento: o atrito aponta no sentido oposto."),
        ],
    )

    seed_completed_session(
        student=students[3],
        teacher=teachers[3],
        subject_slug="mentoria-carreira-tcc",
        service_type=ServiceType.MENTORIA_PROFISSIONAL,
        title="Revisão de arquitetura e escopo do TCC",
        desc="Quero validar o diagrama C4 e o cronograma do meu TCC de sistemas distribuídos.",
        duration_min=45,
        initial_offer=85,
        agreed_tokens=95,
        days_ago=3,
        student_rating=4,
        student_comment="Insights super valiosos para simplificar o MVP do TCC e impressionar a banca.",
        teacher_rating=5,
        teacher_comment="Projeto muito bem estruturado, excelente iniciativa.",
        chat_lines=[
            ("S", "Rafael, estou preocupada se microsserviços vão atrasar o prazo do meu TCC."),
            ("T", "Gabriela, um monólito modular bem testado entrega 10x mais valor na banca. Vamos desenhar os módulos!"),
        ],
    )

    seed_completed_session(
        student=students[4],
        teacher=teachers[1],
        subject_slug="banco-dados-sql",
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Window Functions e índices compostos no PostgreSQL",
        desc="Preciso otimizar uma query com RANK() e entender EXPLAIN ANALYZE.",
        duration_min=30,
        initial_offer=75,
        agreed_tokens=75,
        days_ago=2,
        student_rating=5,
        student_comment="Consegui reduzir a consulta de 4s para 18ms com o índice certo!",
        teacher_rating=4,
        teacher_comment="Ótima sessão prática.",
        chat_lines=[
            ("S", "Professor, meu SELECT com ORDER BY está fazendo Seq Scan."),
            ("T", "Vamos criar um índice composto (status, created_at DESC) e validar no EXPLAIN ANALYZE."),
        ],
    )

    seed_completed_session(
        student=students[5],
        teacher=teachers[0],
        subject_slug="estatistica-prob",
        service_type=ServiceType.MENTORIA_PROFISSIONAL,
        title="Teste de hipóteses e p-valor em Python",
        desc="Ajuda para interpretar teste t de Student no meu relatório de Ciência de Dados.",
        duration_min=40,
        initial_offer=70,
        agreed_tokens=70,
        days_ago=1,
        student_rating=5,
        student_comment="Explicação cristalina sobre erro tipo I e intervalo de confiança.",
        teacher_rating=5,
        teacher_comment="Excelente base analítica!",
        chat_lines=[
            ("S", "Profa., quando p = 0.03 eu rejeito H0 ao nível de 5%, certo?"),
            ("T", "Correto Camila! E vale reportar também o tamanho de efeito (Cohen's d)."),
        ],
    )

    # 6. Sessão AGENDADA pronta para iniciar na demo (Aluno 1 <-> Prof. Carlos)
    req_sched = ServiceRequest(
        student_id=students[0].id,
        teacher_id=teachers[1].id,
        subject_id=subjects["banco-dados-sql"].id,
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Normalização 3FN e transações ACID no projeto da faculdade",
        description="Quero revisar as chaves estrangeiras e locks de transação do meu trabalho de Banco de Dados.",
        duration_minutes=30,
        offered_tokens=75,
        agreed_tokens=75,
        proposed_scheduled_at=now + timedelta(minutes=15),
        status=RequestStatus.AGENDADA,
        created_at=now - timedelta(hours=3),
    )
    db.add(req_sched)
    db.flush()
    db.add(
        Proposal(
            request_id=req_sched.id,
            sender_id=students[0].id,
            teacher_id=teachers[1].id,
            offered_tokens=75,
            suggested_datetime=now + timedelta(minutes=15),
            message="Podemos revisar hoje rapidinho? Ofereço 75 tokens.",
            status=ProposalStatus.ACCEPTED,
        )
    )
    sess_sched = TutoringSession(
        request_id=req_sched.id,
        student_id=students[0].id,
        teacher_id=teachers[1].id,
        subject_id=subjects["banco-dados-sql"].id,
        status=RequestStatus.AGENDADA,
        agreed_tokens=75,
        planned_duration_minutes=30,
        scheduled_at=now + timedelta(minutes=15),
    )
    db.add(sess_sched)
    db.flush()
    lock_escrow(
        db,
        student_id=students[0].id,
        amount=75,
        request_id=req_sched.id,
        session_id=sess_sched.id,
        idempotency_key=f"seed:lock:sess:{sess_sched.id}",
    )
    db.add(
        Message(
            session_id=sess_sched.id,
            sender_id=teachers[1].id,
            content="Olá Lucas! Já estou online na sala. Quando estiver pronto, pode clicar em Iniciar Sessão!",
            created_at=now - timedelta(minutes=5),
        )
    )

    # 7. Sessão CANCELADA com estorno completo (para métricas do dashboard)
    req_cancel = ServiceRequest(
        student_id=students[6].id,
        teacher_id=teachers[2].id,
        subject_id=subjects["fisica-mecanica"].id,
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Conservação de momento angular",
        description="Revisão rápida de colisões elásticas.",
        duration_minutes=20,
        offered_tokens=45,
        agreed_tokens=45,
        status=RequestStatus.CANCELADA,
        created_at=now - timedelta(days=2),
    )
    db.add(req_cancel)
    db.flush()
    sess_cancel = TutoringSession(
        request_id=req_cancel.id,
        student_id=students[6].id,
        teacher_id=teachers[2].id,
        subject_id=subjects["fisica-mecanica"].id,
        status=RequestStatus.CANCELADA,
        agreed_tokens=45,
        planned_duration_minutes=20,
        ended_at=now - timedelta(days=2, hours=-1),
    )
    db.add(sess_cancel)
    db.flush()
    lock_escrow(
        db,
        student_id=students[6].id,
        amount=45,
        request_id=req_cancel.id,
        session_id=sess_cancel.id,
        idempotency_key=f"seed:lock:sess:{sess_cancel.id}",
    )
    refund_session_escrow(db, sess_cancel)

    # 8. Solicitação com CONTRAPROPOSTA pendente (Aluno 1 <-> Profa. Ana) para demonstrar negociação InDrive!
    req_counter = ServiceRequest(
        student_id=students[0].id,
        teacher_id=teachers[0].id,
        subject_id=subjects["calculo-i-ii"].id,
        service_type=ServiceType.MENTORIA_PROFISSIONAL,
        title="Revisão intensiva de Séries de Taylor e Convergência",
        description="Tenho prova sexta-feira e preciso resolver os 6 exercícios mais difíceis da lista oficial.",
        duration_minutes=45,
        offered_tokens=80,
        proposed_scheduled_at=now + timedelta(hours=3),
        status=RequestStatus.PROPOSTA_ENVIADA,
        created_at=now - timedelta(hours=1),
    )
    db.add(req_counter)
    db.flush()
    db.add(
        Proposal(
            request_id=req_counter.id,
            sender_id=students[0].id,
            teacher_id=teachers[0].id,
            offered_tokens=60,
            suggested_datetime=now + timedelta(hours=2),
            message="Profa. Ana, consegue fazer por 60 tokens?",
            status=ProposalStatus.SUPERSEDED,
            created_at=now - timedelta(minutes=55),
        )
    )
    db.add(
        Proposal(
            request_id=req_counter.id,
            sender_id=teachers[0].id,
            teacher_id=teachers[0].id,
            offered_tokens=80,
            suggested_datetime=now + timedelta(hours=3),
            message="Para 45 minutos com resolução completa dos 6 exercícios, consigo fazer por 80 tokens às 19h. Fechamos?",
            status=ProposalStatus.PENDING,
            created_at=now - timedelta(minutes=20),
        )
    )

    # 9. Solicitação ABERTA (open marketplace request) para qualquer professor responder!
    req_open = ServiceRequest(
        student_id=students[8].id,
        teacher_id=None,
        subject_id=subjects["engenharia-software"].id,
        service_type=ServiceType.MENTORIA_PROFISSIONAL,
        title="Code review da minha API FastAPI + React",
        description="Estou montando meu portfólio e quero feedback de arquitetura, testes e boas práticas REST.",
        duration_minutes=45,
        offered_tokens=75,
        proposed_scheduled_at=now + timedelta(hours=5),
        status=RequestStatus.PROPOSTA_ENVIADA,
        created_at=now - timedelta(minutes=40),
    )
    db.add(req_open)
    db.flush()
    db.add(
        Proposal(
            request_id=req_open.id,
            sender_id=students[8].id,
            teacher_id=None,
            offered_tokens=75,
            suggested_datetime=now + timedelta(hours=5),
            message="Aberto a professores disponíveis em Engenharia de Software!",
            status=ProposalStatus.PENDING,
        )
    )

    # 10. Solicitação RECUSADA e Solicitação EXPIRADA (para cobrir todos os estados)
    req_refused = ServiceRequest(
        student_id=students[7].id,
        teacher_id=teachers[4].id,
        subject_id=subjects["quimica-geral"].id,
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Balanceamento redox urgente",
        description="Preciso de ajuda em 15 minutos para entrega hoje.",
        duration_minutes=15,
        offered_tokens=20,
        status=RequestStatus.RECUSADA,
        created_at=now - timedelta(days=1),
    )
    db.add(req_refused)
    db.flush()
    db.add(
        Proposal(
            request_id=req_refused.id,
            sender_id=students[7].id,
            teacher_id=teachers[4].id,
            offered_tokens=20,
            message="Oferta inicial.",
            status=ProposalStatus.REJECTED,
        )
    )

    req_expired = ServiceRequest(
        student_id=students[9].id,
        teacher_id=None,
        subject_id=subjects["estatistica-prob"].id,
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Distribuição Binomial e Poisson",
        description="Lista de exercícios da semana passada.",
        duration_minutes=20,
        offered_tokens=35,
        status=RequestStatus.EXPIRADA,
        expires_at=now - timedelta(days=1),
        created_at=now - timedelta(days=3),
    )
    db.add(req_expired)

    # Notifications for demo users
    db.add(
        Notification(
            user_id=students[0].id,
            title="Contraproposta da Profa. Ana Clara",
            message="Ela propôs 80 tokens para 'Revisão intensiva de Séries de Taylor'. Aceite ou envie nova oferta!",
            kind="PROPOSAL",
            link="/requests",
        )
    )
    db.add(
        Notification(
            user_id=students[0].id,
            title="Sua sessão com Prof. Carlos está pronta",
            message="A sala de Banco de Dados & SQL está aberta. Clique para entrar!",
            kind="SESSION",
            link=f"/sessions/{sess_sched.id}",
        )
    )
    db.add(
        Notification(
            user_id=teachers[1].id,
            title="Nova solicitação aberta em Engenharia de Software",
            message="Felipe Nascimento ofereceu 75 tokens por 45 min de Code Review.",
            kind="REQUEST",
            link="/requests",
        )
    )

    db.commit()
    return {
        "status": "seeded",
        "admin": 1,
        "teachers": len(teachers),
        "students": len(students),
        "subjects": len(subjects),
    }


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        res = run_seed(db)
        print("Seed result:", res)
    finally:
        db.close()


if __name__ == "__main__":
    main()
