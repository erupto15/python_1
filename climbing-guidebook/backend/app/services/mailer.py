"""Отправка писем через SMTP (stdlib smtplib). Блокирующий вызов — использовать из sync-эндпоинтов или to_thread."""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from app.config import settings


class MailerError(RuntimeError):
    pass


def _sender() -> str:
    return (settings.smtp_from or "").strip() or (settings.smtp_user or "").strip()


def is_configured() -> bool:
    return bool((settings.smtp_host or "").strip() and _sender())


def send_email_sync(to: str, subject: str, body: str) -> None:
    if not is_configured():
        raise MailerError("SMTP is not configured")

    sender = _sender()
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1] if "@" in sender else None)
    msg.set_content(body, charset="utf-8")

    host = settings.smtp_host.strip()
    port = int(settings.smtp_port)
    timeout = float(settings.smtp_timeout_sec)
    security = (settings.smtp_security or "ssl").strip().lower()
    user = (settings.smtp_user or "").strip()
    password = settings.smtp_password or ""

    try:
        if security == "ssl":
            client: smtplib.SMTP = smtplib.SMTP_SSL(
                host, port, timeout=timeout, context=ssl.create_default_context()
            )
        else:
            client = smtplib.SMTP(host, port, timeout=timeout)
        with client:
            if security == "starttls":
                client.starttls(context=ssl.create_default_context())
            if user:
                client.login(user, password)
            client.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise MailerError(f"SMTP send failed: {exc}") from exc